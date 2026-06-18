// app/api/admin/unlocked-schedules/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cron job — runs daily at 23:00 UTC (9:00 AM AEST/Sunshine Coast)
//
// Flow:
//   1. Fetch all job schedules for yesterday → collect staff IDs
//   2. For each staff member fetch their timesheets for yesterday
//   3. Use _href from timesheet to hit nested job cost center schedule endpoint
//   4. Check IsLocked === false explicitly on blocks
//   5. Group unlocked by staff, send email
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";
import { Resend } from "resend";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
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
  return aestNow.toISOString().split("T")[0]; // today instead of yesterday
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

interface TimesheetEntry {
  UID: string;
  ScheduleType: string;
  Reference: string;
  _href: string;
  Date: string;
  StartTime: string;
  EndTime: string;
  TotalHrs: number;
}

interface ScheduleBlock {
  StartTime?: string;
  EndTime?: string;
  IsLocked?: boolean;
  [key: string]: unknown;
}

interface NestedScheduleDetail {
  ID: number;
  IsLocked?: boolean;
  Blocks: ScheduleBlock[];
  [key: string]: unknown;
}

interface UnlockedEntry {
  jobRef: string;
  hours: number;
  unlockedBlocks: number;
  totalBlocks: number;
}

export async function GET() {
  if (!SIMPRO_BASE_URL) {
    return NextResponse.json(
      { error: "SimPRO config missing" },
      { status: 500 },
    );
  }

  try {
    const yesterday = getYesterdayAEST();
    console.log(`[UnlockedSchedules] Checking schedules for ${yesterday}...`);

    // ── 1. Fetch all job schedules for yesterday ──────────────────────────────
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

    // ── 2. Collect unique staff ───────────────────────────────────────────────
    const staffMap = new Map<number, { name: string }>();
    for (const s of jobSchedules) {
      const staffId = s.Staff?.ID;
      const staffName = s.Staff?.Name ?? "Unknown";
      if (!staffId) continue;
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, { name: staffName });
      }
    }

    console.log(`[UnlockedSchedules] ${staffMap.size} unique staff found`);

    // ── 3. For each staff fetch timesheets → hit _href → check IsLocked ───────
    const byStaff = new Map<
      number,
      { name: string; entries: UnlockedEntry[] }
    >();

    await Promise.all(
      Array.from(staffMap.entries()).map(async ([staffId, { name }]) => {
        try {
          const timesheets = await simproGet<TimesheetEntry[]>(
            `${SIMPRO_BASE_URL}/api/v1.0/companies/0/employees/${staffId}/timesheets/` +
              `?StartDate=${yesterday}&EndDate=${yesterday}&Includes=Job`,
          );

          const jobTimesheets = timesheets.filter(
            (t) => t.ScheduleType === "Job" && t._href,
          );

          for (const ts of jobTimesheets) {
            try {
              const nested = await simproGet<NestedScheduleDetail>(
                `${SIMPRO_BASE_URL}${ts._href}`,
              );

              // Log the full raw response so we can see exactly what's returned
              console.log(
                `[UnlockedSchedules] Staff "${name}" _href "${ts._href}" raw:`,
                JSON.stringify(nested),
              );

              const blocks = nested.Blocks ?? [];

              // Only flag if IsLocked is EXPLICITLY false
              const hasUnlocked = blocks.some((b) => b.IsLocked === false);
              if (!hasUnlocked) continue;

              const unlockedBlocks = blocks.filter(
                (b) => b.IsLocked === false,
              ).length;
              const totalBlocks = blocks.length;

              if (!byStaff.has(staffId)) {
                byStaff.set(staffId, { name, entries: [] });
              }

              byStaff.get(staffId)!.entries.push({
                jobRef: ts.Reference ?? "—",
                hours: ts.TotalHrs ?? 0,
                unlockedBlocks,
                totalBlocks,
              });
            } catch (err) {
              console.warn(
                `[UnlockedSchedules] Could not fetch nested for ${ts._href}:`,
                err,
              );
            }
          }
        } catch (err) {
          console.warn(
            `[UnlockedSchedules] Could not fetch timesheets for staff ${staffId}:`,
            err,
          );
        }
      }),
    );

    console.log(
      `[UnlockedSchedules] ${byStaff.size} staff with unlocked blocks`,
    );

    if (byStaff.size === 0) {
      console.log(`[UnlockedSchedules] All blocks locked — no email needed`);
      return NextResponse.json({
        message: "All schedule blocks locked",
        date: yesterday,
        totalChecked: jobSchedules.length,
        unlocked: 0,
      });
    }

    // ── 4. Build email ────────────────────────────────────────────────────────
    const staffSections = Array.from(byStaff.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ name, entries }) => {
        const rows = entries
          .map(
            (e) => `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${e.jobRef}</td>
              <td style="padding:10px 12px;font-size:13px;color:#e53e3e;font-weight:600;">
                ${e.unlockedBlocks} of ${e.totalBlocks} block${e.totalBlocks === 1 ? "" : "s"} unlocked
              </td>
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
              The following staff had job schedules yesterday with <strong>unlocked blocks</strong>.
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

    // ── 5. Send email ─────────────────────────────────────────────────────────
    const resend = getResend();
    await resend.emails.send({
      from: "RAS Admin <sam@rasvertex.com.au>",
      to: RECIPIENTS,
      subject: `Unlocked Schedules — ${byStaff.size} staff · ${yesterday}`,
      html,
    });

    console.log(
      `[UnlockedSchedules] 📧 Email sent — ${byStaff.size} staff with unlocked blocks`,
    );

    return NextResponse.json({
      sent: true,
      date: yesterday,
      totalChecked: jobSchedules.length,
      staffAffected: byStaff.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[UnlockedSchedules]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
