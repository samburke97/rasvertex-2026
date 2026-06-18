// app/api/admin/unlocked-schedules/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cron job — runs daily at 23:00 UTC (9:00 AM AEST/Sunshine Coast)
//
// Uses the same nested section → costCenter → schedules pattern as
// app/api/simpro/jobs/[jobId]/schedule/route.ts which is proven to work.
//
// Flow:
//   1. Fetch all job schedules for yesterday → unique jobIDs
//   2. For each job fetch sections → cost centres → schedules (nested)
//   3. Check IsLocked on each schedule entry
//   4. Group unlocked by staff, send email
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";
import { Resend } from "resend";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;
const PAGE_SIZE = 1000;

const RECIPIENTS = ["sam@rasvertex.com.au"];

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

function getYesterdayAEST(): string {
  const now = new Date();
  const aestOffset = 10 * 60 * 60 * 1000;
  const aestNow = new Date(now.getTime() + aestOffset);
  // TEMP: return today for testing
  return aestNow.toISOString().split("T")[0];
  // PRODUCTION: uncomment below and remove above
  // const yesterday = new Date(aestNow);
  // yesterday.setDate(yesterday.getDate() - 1);
  // return yesterday.toISOString().split("T")[0];
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface ScheduleListItem {
  ID: number;
  Type: string;
  Reference: string;
  TotalHours: number;
  Date: string;
  Staff: { ID: number; Name: string };
}

interface SimproSection {
  ID: number;
}

interface SimproCostCentre {
  ID: number;
}

interface SimproScheduleEntry {
  ID: number;
  TotalHours?: number;
  IsLocked?: boolean;
  Staff?: { ID: number; Name: string };
  Date?: string;
  Notes?: string;
  Blocks?: { StartTime?: string; EndTime?: string; IsLocked?: boolean }[];
}

interface UnlockedEntry {
  jobRef: string;
  staffId: number;
  staffName: string;
  hours: number;
}

export async function GET() {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO config missing" },
      { status: 500 },
    );
  }

  try {
    const yesterday = getYesterdayAEST();
    console.log(`[UnlockedSchedules] Checking schedules for ${yesterday}...`);

    // ── 1. Fetch all job schedules for the date ───────────────────────────────
    const allSchedules: ScheduleListItem[] = [];
    let page = 1;

    while (true) {
      const url =
        `${SIMPRO_BASE_URL}/api/v1.0/companies/0/schedules/` +
        `?pageSize=${PAGE_SIZE}&page=${page}` +
        `&columns=ID,Type,Reference,TotalHours,Date,Staff` +
        `&Date=${yesterday}`;

      const batch = await simproGet<ScheduleListItem[]>(url);
      allSchedules.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    const jobSchedules = allSchedules.filter((s) => s.Type === "job");
    console.log(
      `[UnlockedSchedules] ${jobSchedules.length} job schedules for ${yesterday}`,
    );

    if (jobSchedules.length === 0) {
      return NextResponse.json({
        message: "No job schedules for yesterday",
        date: yesterday,
        unlocked: 0,
      });
    }

    // ── 2. Extract unique job IDs from Reference ("jobID-costCenterID") ───────
    const jobIds = new Set<number>();
    for (const s of jobSchedules) {
      const jobId = parseInt(s.Reference.split("-")[0], 10);
      if (!isNaN(jobId)) jobIds.add(jobId);
    }

    console.log(`[UnlockedSchedules] ${jobIds.size} unique jobs found`);

    // ── 3. For each job: sections → cost centres → schedules ──────────────────
    const unlockedEntries: UnlockedEntry[] = [];

    await Promise.all(
      Array.from(jobIds).map(async (jobId) => {
        try {
          const base = `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${jobId}`;

          // Get sections
          const sections = await simproGet<SimproSection[]>(
            `${base}/sections/?pageSize=250`,
          );

          // Get cost centres for all sections in parallel
          const ccResults = await Promise.all(
            sections.map(async (section) => {
              try {
                const ccs = await simproGet<SimproCostCentre[]>(
                  `${base}/sections/${section.ID}/costCenters/?pageSize=250`,
                );
                return { sectionId: section.ID, ccs };
              } catch {
                return { sectionId: section.ID, ccs: [] };
              }
            }),
          );

          // Get schedules for all section/costCentre pairs in parallel
          await Promise.all(
            ccResults.flatMap(({ sectionId, ccs }) =>
              ccs.map(async (cc) => {
                try {
                  const schedules = await simproGet<SimproScheduleEntry[]>(
                    `${base}/sections/${sectionId}/costCenters/${cc.ID}/schedules/?pageSize=250`,
                  );

                  for (const s of schedules) {
                    // Only check today's date
                    if (s.Date !== yesterday) continue;
                    if (!s.Staff?.ID) continue;

                    // Log raw to see what IsLocked looks like
                    console.log(
                      `[UnlockedSchedules] Job ${jobId} section ${sectionId} cc ${cc.ID} schedule ${s.ID}:`,
                      JSON.stringify(s),
                    );

                    // Check IsLocked — on schedule level or block level
                    const scheduleUnlocked = s.IsLocked === false;
                    const blockUnlocked =
                      s.Blocks?.some((b) => b.IsLocked === false) ?? false;

                    if (!scheduleUnlocked && !blockUnlocked) continue;

                    unlockedEntries.push({
                      jobRef: `${jobId}-${cc.ID}`,
                      staffId: s.Staff.ID,
                      staffName: s.Staff.Name ?? "Unknown",
                      hours: s.TotalHours ?? 0,
                    });
                  }
                } catch (err) {
                  console.warn(
                    `[UnlockedSchedules] Job ${jobId} section ${sectionId} cc ${cc.ID} failed:`,
                    err,
                  );
                }
              }),
            ),
          );
        } catch (err) {
          console.warn(`[UnlockedSchedules] Job ${jobId} failed:`, err);
        }
      }),
    );

    console.log(
      `[UnlockedSchedules] ${unlockedEntries.length} unlocked schedule entries`,
    );

    if (unlockedEntries.length === 0) {
      console.log(`[UnlockedSchedules] All schedules locked — no email needed`);
      return NextResponse.json({
        message: "All schedule blocks locked",
        date: yesterday,
        totalChecked: jobSchedules.length,
        unlocked: 0,
      });
    }

    // ── 4. Group by staff ─────────────────────────────────────────────────────
    const byStaff = new Map<
      number,
      { name: string; entries: { jobRef: string; hours: number }[] }
    >();

    for (const e of unlockedEntries) {
      if (!byStaff.has(e.staffId)) {
        byStaff.set(e.staffId, { name: e.staffName, entries: [] });
      }
      byStaff.get(e.staffId)!.entries.push({
        jobRef: e.jobRef,
        hours: e.hours,
      });
    }

    // ── 5. Build email ────────────────────────────────────────────────────────
    const staffSections = Array.from(byStaff.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ name, entries }) => {
        const rows = entries
          .map(
            (e) => `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${e.jobRef}</td>
              <td style="padding:10px 12px;font-size:13px;color:#e53e3e;font-weight:600;">Not locked</td>
              <td style="padding:10px 12px;font-size:13px;color:#888;text-align:right;">${e.hours.toFixed(2)} hrs</td>
            </tr>
          `,
          )
          .join("");

        return `
          <div style="margin-bottom:28px;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f2d4a;border-bottom:2px solid #0f2d4a;padding-bottom:6px;">${name}</p>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f0f4f8;">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Job Reference</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Status</th>
                  <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Hours</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const html = `
      <div style="background:#f4f4f0;padding:2rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:600px;margin:0 auto;">

          <div style="background:#0f2d4a;border-radius:10px 10px 0 0;padding:24px 32px;">
            <p style="margin:0 0 2px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">RAS Vertex</p>
            <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">Unlocked Schedules — ${fmtDate(yesterday)}</p>
          </div>

          <div style="background:#fff;padding:28px 32px 24px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
            <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Sam,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              The following staff had job schedules yesterday that were <strong>not locked</strong>.
              Please follow up with them to confirm their job cards.
            </p>
            ${staffSections}
          </div>

          <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              Daily automated check · RAS Vertex · Schedules for ${yesterday} · Test mode
            </p>
          </div>

        </div>
      </div>
    `;

    // ── 6. Send email ─────────────────────────────────────────────────────────
    const resend = getResend();
    await resend.emails.send({
      from: "RAS Admin <sam@rasvertex.com.au>",
      to: RECIPIENTS,
      subject: `Unlocked Schedules — ${byStaff.size} staff · ${yesterday}`,
      html,
    });

    console.log(
      `[UnlockedSchedules] 📧 Email sent — ${byStaff.size} staff with unlocked schedules`,
    );

    return NextResponse.json({
      sent: true,
      date: yesterday,
      totalChecked: jobSchedules.length,
      unlocked: unlockedEntries.length,
      staffAffected: byStaff.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[UnlockedSchedules]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
