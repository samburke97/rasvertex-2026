// lib/workspace/store.ts
// Neon Postgres via @neondatabase/serverless
// Run the migration SQL once in the Neon SQL Editor (see bottom of file).
// Same house convention as lib/crm/store.ts — raw tagged-template SQL, no ORM.
//
// A workspace item is one row in the sidebar tree: a folder (groups other
// items), a doc (Tiptap-authored HTML content, see components/workspace/
// DocEditor.tsx), or a table (a shortcut to a real page elsewhere in the
// app — 'leads' -> /crm, 'recurring-jobs' -> /recurring-jobs). There's no
// generic table-building feature in this app, so 'table' items are only
// ever the two seeded shortcuts; only docs and folders are user-creatable.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

function sql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Migration — run this ONCE in Neon SQL Editor ──────────────────────────
// CREATE TABLE IF NOT EXISTS workspace_items (
//   id          SERIAL PRIMARY KEY,
//   type        TEXT NOT NULL,                              -- 'table' | 'doc' | 'folder'
//   parent_id   INTEGER REFERENCES workspace_items(id) ON DELETE CASCADE,
//   name        TEXT NOT NULL,
//   position    INTEGER NOT NULL DEFAULT 0,
//   content     TEXT,                                        -- HTML, only for type='doc'
//   table_ref   TEXT,                                         -- only for type='table'
//   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// CREATE INDEX IF NOT EXISTS workspace_items_parent_id_idx ON workspace_items(parent_id);
//
// -- Seed: Leads/Recurring Jobs shortcuts + a Sales folder with two reference docs.
// INSERT INTO workspace_items (type, name, position, table_ref) VALUES
//   ('table', 'Leads', 0, 'leads'),
//   ('table', 'Recurring Jobs', 1, 'recurring-jobs');
//
// WITH sales AS (
//   INSERT INTO workspace_items (type, name, position) VALUES ('folder', 'Sales', 2)
//   RETURNING id
// )
// INSERT INTO workspace_items (type, parent_id, name, position, content)
// SELECT 'doc', sales.id, doc.name, doc.position, doc.content
// FROM sales, (VALUES
//   ('Existing Works Call Back', 0, '<h2>Opening</h2><blockquote>“Hi [name], it’s [you] from RAS-Vertex — we did the [work type] on [building] back in [month]. Just doing a round of check-ins on the buildings we’ve worked on. How has it held up?”</blockquote><h2>What to listen for</h2><ul><li>Anything new since we finished — staining, movement, leaks after storms.</li><li>Budget cycle timing — find out when their committee decides.</li><li>A change of building or facilities manager.</li></ul>'),
//   ('Sales Outreach Template', 1, '<p>The sequence we run on cold strata and facilities contacts. Five touches over three weeks. Stop the moment they reply.</p><h2>Touch 1 — Intro email</h2><p>Short. Name the building, name one thing we noticed about it, and ask one question.</p><h2>Touch 2 — Follow-up call</h2><p>Two business days after the email, referencing it in the first sentence.</p>')
// ) AS doc(name, position, content);

export type WorkspaceItemType = "table" | "doc" | "folder";

export interface WorkspaceItem {
  id: number;
  type: WorkspaceItemType;
  parentId: number | null;
  name: string;
  position: number;
  content: string | null;
  tableRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(r: any): WorkspaceItem {
  return {
    id: r.id,
    type: r.type,
    parentId: r.parent_id,
    name: r.name,
    position: r.position,
    content: r.content,
    tableRef: r.table_ref,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listWorkspaceItems(): Promise<WorkspaceItem[]> {
  const db = sql();
  const rows = await db`
    SELECT * FROM workspace_items
    ORDER BY parent_id NULLS FIRST, position ASC, id ASC
  `;
  return rows.map(mapItem);
}

export async function getWorkspaceItem(id: number): Promise<WorkspaceItem | null> {
  const db = sql();
  const rows = await db`SELECT * FROM workspace_items WHERE id = ${id}`;
  return rows.length ? mapItem(rows[0]) : null;
}

export interface CreateWorkspaceItemInput {
  type: "doc" | "folder";
  name: string;
  parentId?: number | null;
}

export async function createWorkspaceItem(
  input: CreateWorkspaceItemInput,
): Promise<WorkspaceItem> {
  const db = sql();
  const parentId = input.parentId ?? null;
  const [{ next_position }] = await db`
    SELECT COALESCE(MAX(position), -1) + 1 AS next_position
    FROM workspace_items
    WHERE parent_id IS NOT DISTINCT FROM ${parentId}
  `;
  const rows = await db`
    INSERT INTO workspace_items (type, parent_id, name, position, content)
    VALUES (
      ${input.type},
      ${parentId},
      ${input.name},
      ${next_position},
      ${input.type === "doc" ? "" : null}
    )
    RETURNING *
  `;
  return mapItem(rows[0]);
}

export interface UpdateWorkspaceItemInput {
  name?: string;
  parentId?: number | null;
  position?: number;
  content?: string;
}

export async function updateWorkspaceItem(
  id: number,
  patch: UpdateWorkspaceItemInput,
): Promise<WorkspaceItem | null> {
  const db = sql();
  const existing = await getWorkspaceItem(id);
  if (!existing) return null;

  const rows = await db`
    UPDATE workspace_items
    SET name = ${patch.name ?? existing.name},
        parent_id = ${patch.parentId !== undefined ? patch.parentId : existing.parentId},
        position = ${patch.position ?? existing.position},
        content = ${patch.content !== undefined ? patch.content : existing.content},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return mapItem(rows[0]);
}

// Folders cascade via the FK's ON DELETE CASCADE — no manual recursion needed.
export async function deleteWorkspaceItem(id: number): Promise<boolean> {
  const db = sql();
  const rows = await db`DELETE FROM workspace_items WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
