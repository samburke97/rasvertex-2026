// app/api/workspace/items/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listWorkspaceItems, createWorkspaceItem } from "@/lib/workspace/store";

export async function GET() {
  try {
    const items = await listWorkspaceItems();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[Workspace] listWorkspaceItems failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch workspace items." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { type?: string; name?: string; parentId?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.type !== "doc" && body.type !== "folder") {
    return NextResponse.json(
      { error: "type must be 'doc' or 'folder'" },
      { status: 400 },
    );
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const item = await createWorkspaceItem({
      type: body.type,
      name: body.name.trim(),
      parentId: body.parentId ?? null,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error("[Workspace] createWorkspaceItem failed:", err);
    return NextResponse.json(
      { error: "Failed to create workspace item." },
      { status: 500 },
    );
  }
}
