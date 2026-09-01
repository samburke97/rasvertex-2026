// app/api/crm/columns/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  listCustomColumns,
  createCustomColumn,
  type CustomColumnOption,
} from "@/lib/crm/store";

function validOptions(value: unknown): value is CustomColumnOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (o) =>
        o &&
        typeof o.id === "string" &&
        typeof o.label === "string" &&
        typeof o.color === "string" &&
        o.id.trim() &&
        o.label.trim(),
    )
  );
}

export async function GET() {
  try {
    const columns = await listCustomColumns();
    return NextResponse.json({ columns });
  } catch (err) {
    console.error("[CRM] listCustomColumns failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch columns." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { label?: string; options?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!body.label?.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (!validOptions(body.options)) {
    return NextResponse.json({ error: "Invalid options" }, { status: 400 });
  }

  try {
    const column = await createCustomColumn(body.label.trim(), body.options);
    return NextResponse.json({ column }, { status: 201 });
  } catch (err) {
    console.error("[CRM] createCustomColumn failed:", err);
    return NextResponse.json(
      { error: "Failed to create column." },
      { status: 500 },
    );
  }
}
