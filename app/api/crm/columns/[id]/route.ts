// app/api/crm/columns/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  updateCustomColumn,
  deleteCustomColumn,
  type CustomColumnOption,
} from "@/lib/crm/store";

type Params = { params: Promise<{ id: string }> };

function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

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

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "Invalid column ID" }, { status: 400 });

  let body: { label?: string; options?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.label !== undefined && !body.label.trim()) {
    return NextResponse.json({ error: "label cannot be empty" }, { status: 400 });
  }
  if (body.options !== undefined && !validOptions(body.options)) {
    return NextResponse.json({ error: "Invalid options" }, { status: 400 });
  }

  try {
    const column = await updateCustomColumn(id, {
      label: body.label?.trim(),
      options: body.options,
    });
    if (!column) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ column });
  } catch (err) {
    console.error("[CRM] updateCustomColumn failed:", err);
    return NextResponse.json(
      { error: "Failed to update column." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "Invalid column ID" }, { status: 400 });

  try {
    const deleted = await deleteCustomColumn(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CRM] deleteCustomColumn failed:", err);
    return NextResponse.json(
      { error: "Failed to delete column." },
      { status: 500 },
    );
  }
}
