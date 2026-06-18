// app/api/admin/unlocked-schedules/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cron job — runs daily at 21:30 UTC (7:30 AM AEST/Sunshine Coast)
//
// Flow:
//   1. Fetch all job schedules for yesterday via unified endpoint
//   2. For each schedule fetch detail via _href → read top-level IsLocked
//   3. Flag where IsLocked === false
//   4. Group by staff, send email
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
  const yesterday = new Date(aestNow);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
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

interface ScheduleDetail {
  ID: number;
  IsLocked: boolean;
  TotalHours: number;
  Staff: { ID: number; Name: string };
  Date: string;
}

interface UnlockedEntry {
  jobRef: string;
  hours: number;
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

    // ── 1. Fetch all schedules for yesterday ──────────────────────────────────
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
        message: "No job schedules found",
        date: yesterday,
        unlocked: 0,
      });
    }

    // ── 2. Fetch detail for each via _href → check IsLocked ──────────────────
    const byStaff = new Map<
      number,
      { name: string; entries: UnlockedEntry[] }
    >();

    await Promise.all(
      jobSchedules.map(async (s) => {
        try {
          // Step A: get _href from unified detail
          const unified = await simproGet<{ _href?: string }>(
            `${SIMPRO_BASE_URL}/api/v1.0/companies/0/schedules/${s.ID}`,
          );

          if (!unified._href) {
            console.warn(`[UnlockedSchedules] No _href for schedule ${s.ID}`);
            return;
          }

          // Step B: hit nested endpoint to get IsLocked
          const detail = await simproGet<ScheduleDetail>(
            `${SIMPRO_BASE_URL}${unified._href}`,
          );

          console.log(
            `[UnlockedSchedules] Schedule ${s.ID} — staff: "${s.Staff?.Name}", IsLocked: ${detail.IsLocked}`,
          );

          if (detail.IsLocked === false) {
            const staffId = s.Staff?.ID;
            const staffName = s.Staff?.Name ?? "Unknown";

            if (!staffId) return;

            if (!byStaff.has(staffId)) {
              byStaff.set(staffId, { name: staffName, entries: [] });
            }

            byStaff.get(staffId)!.entries.push({
              jobRef: s.Reference ?? "—",
              hours: s.TotalHours ?? 0,
            });
          }
        } catch (err) {
          console.warn(`[UnlockedSchedules] Failed for schedule ${s.ID}:`, err);
        }
      }),
    );

    console.log(
      `[UnlockedSchedules] ${byStaff.size} staff with unlocked schedules`,
    );

    if (byStaff.size === 0) {
      console.log(`[UnlockedSchedules] All schedules locked — no email needed`);
      return NextResponse.json({
        message: "All schedules locked",
        date: yesterday,
        totalChecked: jobSchedules.length,
        unlocked: 0,
      });
    }

    // ── 3. Build email ────────────────────────────────────────────────────────
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
            <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              The following staff had job schedules yesterday that were <strong>not locked</strong>.
              Please follow up with them to confirm their job cards.
            </p>
            ${staffSections}
          </div>

          <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              Daily automated check · RAS Vertex · Schedules for ${yesterday}
            </p>
          </div>

        </div>
      </div>
    `;

    // ── 4. Send email ─────────────────────────────────────────────────────────
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
      unlocked: byStaff.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[UnlockedSchedules]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
