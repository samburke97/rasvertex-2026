// app/api/workspace/items/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { updateWorkspaceItem, deleteWorkspaceItem } from "@/lib/workspace/store";

type Params = { params: Promise<{ id: string }> };

function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });

  let body: {
    name?: string;
    parentId?: number | null;
    position?: number;
    content?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  }

  try {
    const item = await updateWorkspaceItem(id, body);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[Workspace] updateWorkspaceItem failed:", err);
    return NextResponse.json(
      { error: "Failed to update workspace item." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });

  try {
    const deleted = await deleteWorkspaceItem(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Workspace] deleteWorkspaceItem failed:", err);
    return NextResponse.json(
      { error: "Failed to delete workspace item." },
      { status: 500 },
    );
  }
}
