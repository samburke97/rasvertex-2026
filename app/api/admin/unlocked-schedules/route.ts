// app/api/admin/unlocked-schedules/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cron job — runs daily at 23:00 UTC (9:00 AM AEST/Sunshine Coast)
//
// Logic: scheduled yesterday but no timesheet entry = didn't confirm/clock on
//
// Flow:
//   1. Fetch all job schedules for yesterday → who was scheduled + their staffID
//   2. For each unique staff member, fetch their timesheets for yesterday
//   3. Anyone with a schedule but no timesheet entry = not confirmed
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

function getCheckDateAEST(): string {
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

interface TimesheetEntry {
  UID: string;
  ScheduleType: string;
  Reference: string;
  _href: string;
  Date: string;
  TotalHrs: number;
}

interface StaffSchedule {
  staffId: number;
  staffName: string;
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
    const checkDate = getCheckDateAEST();
    console.log(`[UnlockedSchedules] Checking schedules for ${checkDate}...`);

    // ── 1. Fetch all job schedules for the date ───────────────────────────────
    const allSchedules: ScheduleListItem[] = [];
    let page = 1;

    while (true) {
      const url =
        `${SIMPRO_BASE_URL}/api/v1.0/companies/0/schedules/` +
        `?pageSize=${PAGE_SIZE}&page=${page}` +
        `&columns=ID,Type,Reference,TotalHours,Date,Staff` +
        `&Date=${checkDate}`;

      const batch = await simproGet<ScheduleListItem[]>(url);
      allSchedules.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    const jobSchedules = allSchedules.filter((s) => s.Type === "job");
    console.log(
      `[UnlockedSchedules] ${jobSchedules.length} job schedules for ${checkDate}`,
    );

    if (jobSchedules.length === 0) {
      return NextResponse.json({
        message: "No job schedules found",
        date: checkDate,
        unlocked: 0,
      });
    }

    // ── 2. Build map of who was scheduled ─────────────────────────────────────
    // staffId → { name, schedules[] }
    const scheduledStaff = new Map<
      number,
      { name: string; schedules: StaffSchedule[] }
    >();

    for (const s of jobSchedules) {
      const staffId = s.Staff?.ID;
      const staffName = s.Staff?.Name ?? "Unknown";
      if (!staffId) continue;

      if (!scheduledStaff.has(staffId)) {
        scheduledStaff.set(staffId, { name: staffName, schedules: [] });
      }

      scheduledStaff.get(staffId)!.schedules.push({
        staffId,
        staffName,
        jobRef: s.Reference ?? "—",
        hours: s.TotalHours ?? 0,
      });
    }

    console.log(
      `[UnlockedSchedules] ${scheduledStaff.size} unique staff scheduled`,
    );

    // ── 3. For each scheduled staff, check if they have a timesheet entry ─────
    const notConfirmed = new Map<
      number,
      { name: string; schedules: StaffSchedule[] }
    >();

    await Promise.all(
      Array.from(scheduledStaff.entries()).map(
        async ([staffId, { name, schedules }]) => {
          try {
            const timesheets = await simproGet<TimesheetEntry[]>(
              `${SIMPRO_BASE_URL}/api/v1.0/companies/0/employees/${staffId}/timesheets/` +
                `?StartDate=${checkDate}&EndDate=${checkDate}&Includes=Job`,
            );

            const jobTimesheets = timesheets.filter(
              (t) => t.ScheduleType === "Job",
            );

            console.log(
              `[UnlockedSchedules] Staff "${name}" — scheduled: ${schedules.length}, timesheets: ${jobTimesheets.length}`,
            );

            // If they have no job timesheet entries → not confirmed
            if (jobTimesheets.length === 0) {
              notConfirmed.set(staffId, { name, schedules });
            }
          } catch (err) {
            console.warn(
              `[UnlockedSchedules] Could not fetch timesheets for staff ${staffId} (${name}):`,
              err,
            );
            // If we can't fetch timesheets, assume not confirmed
            notConfirmed.set(staffId, { name, schedules });
          }
        },
      ),
    );

    console.log(
      `[UnlockedSchedules] ${notConfirmed.size} staff with no timesheet entry`,
    );

    if (notConfirmed.size === 0) {
      console.log(`[UnlockedSchedules] All staff confirmed — no email needed`);
      return NextResponse.json({
        message: "All staff confirmed timesheets",
        date: checkDate,
        totalChecked: scheduledStaff.size,
        notConfirmed: 0,
      });
    }

    // ── 4. Build email ────────────────────────────────────────────────────────
    const staffSections = Array.from(notConfirmed.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ name, schedules }) => {
        const rows = schedules
          .map(
            (s) => `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${s.jobRef}</td>
              <td style="padding:10px 12px;font-size:13px;color:#e53e3e;font-weight:600;">No timesheet</td>
              <td style="padding:10px 12px;font-size:13px;color:#888;text-align:right;">${s.hours.toFixed(2)} hrs</td>
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
                  <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Scheduled Hrs</th>
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
            <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">Missing Timesheets — ${fmtDate(checkDate)}</p>
          </div>

          <div style="background:#fff;padding:28px 32px 24px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
            <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              The following staff were scheduled yesterday but have <strong>no timesheet entry</strong>.
              They may not have clocked on, or did not confirm their job card.
              Please follow up with them.
            </p>

            ${staffSections}
          </div>

          <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              Daily automated check · RAS Vertex · Schedules for ${checkDate} · Test mode
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
      subject: `Missing Timesheets — ${notConfirmed.size} staff · ${checkDate}`,
      html,
    });

    console.log(
      `[UnlockedSchedules] 📧 Email sent — ${notConfirmed.size} staff with no timesheet`,
    );

    return NextResponse.json({
      sent: true,
      date: checkDate,
      totalChecked: scheduledStaff.size,
      notConfirmed: notConfirmed.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[UnlockedSchedules]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
