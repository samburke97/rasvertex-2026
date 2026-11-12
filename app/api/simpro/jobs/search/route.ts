// app/api/simpro/jobs/search/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Find a SimPRO job by number, site or customer, for filling the Weekly
// schedule. GET ?q=11357 | ?q=First Bay  →  { results: JobHit[] } (max 10)
//
// SimPRO filters (checked against the live API): ID takes an exact number;
// Site.Name and Customer.CompanyName match part of a name with %…%; Stage
// in(Pending,Progress) keeps to open and in-progress jobs. The three are
// asked in parallel and merged, the job-number match first.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";
import { cleanSite } from "@/lib/reports/weekSchedule";

const API = `${process.env.NEXT_PUBLIC_SIMPRO_BASE_URL}/api/v1.0/companies/0`;
const COLS = "columns=ID,Name,Site,Customer,Stage";
const OPEN = "Stage=in(Pending,Progress)";
const MAX = 10;

export interface JobHit {
  id: number;
  site: string;
  name: string;
  customer: string;
  stage: string;
}

interface SimproJob {
  ID: number;
  Name?: string;
  Stage?: string;
  Site?: { Name?: string };
  Customer?: { CompanyName?: string; GivenName?: string; FamilyName?: string };
}

const hit = (j: SimproJob): JobHit => {
  const c = j.Customer;
  return {
    id: j.ID,
    site: cleanSite(j.Site?.Name ?? ""),
    name: (j.Name ?? "").trim(),
    customer: (c?.CompanyName?.trim() || [c?.GivenName, c?.FamilyName].filter(Boolean).join(" ")).trim(),
    stage: j.Stage ?? "",
  };
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  // Wildcards are SimPRO's, not the user's: % and , would change the filter.
  const like = encodeURIComponent(`%${q.replace(/[%,()]/g, " ").trim()}%`);
  const asks: Promise<SimproJob[]>[] = [
    simproGet<SimproJob[]>(`${API}/jobs/?${OPEN}&Site.Name=${like}&${COLS}&pageSize=${MAX}`),
    simproGet<SimproJob[]>(`${API}/jobs/?${OPEN}&Customer.CompanyName=${like}&${COLS}&pageSize=${MAX}`),
  ];
  // A job number finds the job whatever its stage.
  if (/^\d{3,7}$/.test(q)) asks.unshift(simproGet<SimproJob[]>(`${API}/jobs/?ID=${q}&${COLS}`));
  try {
    const lists = await Promise.allSettled(asks);
    const seen = new Set<number>();
    const results: JobHit[] = [];
    for (const l of lists) {
      if (l.status !== "fulfilled") continue;
      for (const j of l.value) {
        if (seen.has(j.ID) || results.length >= MAX) continue;
        seen.add(j.ID);
        results.push(hit(j));
      }
    }
    if (!results.length && lists.every((l) => l.status === "rejected")) throw (lists[0] as PromiseRejectedResult).reason;
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[JobSearch]", err);
    return NextResponse.json({ error: "Couldn't search SimPRO" }, { status: 502 });
  }
}
