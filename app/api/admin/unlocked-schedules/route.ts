// app/api/admin/unlocked-schedules/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cron job — runs daily at 23:00 UTC (9:00 AM AEST/Sunshine Coast)
//
// Fetches all job schedules from yesterday, filters to unlocked ones,
// groups by staff member, sends summary email to amanda + team.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";
import { Resend } from "resend";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const PAGE_SIZE = 1000;

const RECIPIENTS = ["team@rasvertex.com.au", "amanda@rasvertex.com.au"];

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

function getYesterdayAEST(): string {
  // Sunshine Coast is UTC+10, no daylight saving
  const now = new Date();
  const aestOffset = 10 * 60 * 60 * 1000;
  const aestNow = new Date(now.getTime() + aestOffset);
  const yesterday = new Date(aestNow);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0]; // YYYY-MM-DD
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface SimproSchedule {
  ID: number;
  Type: string;
  Reference: string;
  IsLocked: boolean;
  TotalHours: number;
  Date: string;
  Staff: { ID: number; Name: string };
}

interface UnlockedEntry {
  scheduleId: number;
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

    // ── Fetch all schedules for yesterday ─────────────────────────────────────
    const allSchedules: SimproSchedule[] = [];
    let page = 1;

    while (true) {
      const url =
        `${SIMPRO_BASE_URL}/api/v1.0/companies/0/schedules/` +
        `?pageSize=${PAGE_SIZE}&page=${page}` +
        `&columns=ID,Type,Reference,IsLocked,TotalHours,Date,Staff` +
        `&Date=${yesterday}`;

      const batch = await simproGet<SimproSchedule[]>(url);
      allSchedules.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    console.log(
      `[UnlockedSchedules] Fetched ${allSchedules.length} schedules for ${yesterday}`,
    );

    // ── Filter: job type + not locked ─────────────────────────────────────────
    const unlocked = allSchedules.filter(
      (s) => s.Type === "job" && s.IsLocked === false,
    );

    console.log(
      `[UnlockedSchedules] ${unlocked.length} unlocked job schedules found`,
    );

    if (unlocked.length === 0) {
      console.log(`[UnlockedSchedules] All schedules locked — no email needed`);
      return NextResponse.json({
        message: "All schedules locked",
        date: yesterday,
        total: allSchedules.length,
        unlocked: 0,
      });
    }

    // ── Group by staff ────────────────────────────────────────────────────────
    const byStaff = new Map<
      number,
      { name: string; entries: UnlockedEntry[] }
    >();

    for (const s of unlocked) {
      const staffId = s.Staff?.ID;
      const staffName = s.Staff?.Name ?? "Unknown";

      if (!staffId) continue;

      if (!byStaff.has(staffId)) {
        byStaff.set(staffId, { name: staffName, entries: [] });
      }

      byStaff.get(staffId)!.entries.push({
        scheduleId: s.ID,
        jobRef: s.Reference ?? "—",
        hours: s.TotalHours ?? 0,
      });
    }

    // ── Build email ───────────────────────────────────────────────────────────
    const staffSections = Array.from(byStaff.values())
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
          <div style="margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f2d4a;">${name}</p>
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

    // ── Send email ────────────────────────────────────────────────────────────
    const resend = getResend();
    await resend.emails.send({
      from: "RAS Admin <sam@rasvertex.com.au>",
      to: RECIPIENTS,
      subject: `Unlocked Schedules — ${unlocked.length} staff · ${yesterday}`,
      html,
    });

    console.log(
      `[UnlockedSchedules] 📧 Email sent — ${unlocked.length} unlocked across ${byStaff.size} staff`,
    );

    return NextResponse.json({
      sent: true,
      date: yesterday,
      totalChecked: allSchedules.length,
      unlocked: unlocked.length,
      staffAffected: byStaff.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[UnlockedSchedules]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
