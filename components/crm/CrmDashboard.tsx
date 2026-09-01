"use client";
// components/crm/CrmDashboard.tsx
//
// Leads grouped by pipeline stage, with client-side search and a "chasing"
// star toggle. Fetches the full list once (plain useState/fetch, matching
// ReportSelector.tsx's idiom — no data-fetching library exists in this app)
// and filters/groups client-side, since a small business's lead count
// doesn't warrant a round trip per filter click.
//
// Also supports Monday.com-style custom "status" columns: users can add a
// column (via the "Columns" menu at the top right of the table), give it a
// set of labelled, coloured options, and set a per-lead value from a pill
// dropdown in each row. Column definitions are shared across all stage
// groups; each lead stores its chosen option id per column in customFields.
// The Columns menu also toggles which of those columns are currently shown.
//
// Row checkboxes support bulk actions (chase / convert) via a floating bar,
// and Opportunities-stage rows get a per-row "Convert to job" action, which
// simply closes the deal by moving the lead to the (existing) "won" stage —
// there's no separate Jobs system in this app to hand off to.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./CrmDashboard.module.css";
import LeadDetailPanel from "./LeadDetailPanel";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type Lead,
  type LeadStage,
  type CustomColumn,
  type CustomColumnOption,
} from "@/lib/crm/store";

const STAGE_COLORS: Record<LeadStage, string> = {
  cold: "#6b7280",
  contacted: "#2563eb",
  qualified: "#7c3aed",
  quoted: "#d97706",
  won: "#16a34a",
  lost: "#dc2626",
};

// Stage pill tint/text colours, reusing the app's existing design tokens
// (these map 1:1 onto the leads.css reference's --slate/--gold/--green/--red
// families already present in globals.css).
const STAGE_PILL_STYLE: Record<LeadStage, { background: string; color: string }> = {
  cold: { background: "rgba(23, 23, 26, 0.05)", color: "var(--rv-ink-60)" },
  contacted: { background: "var(--rv-slate-tint)", color: "var(--rv-slate)" },
  qualified: { background: "var(--rv-gold-tint)", color: "var(--rv-gold)" },
  quoted: { background: "var(--rv-green-tint)", color: "var(--rv-green)" },
  won: { background: "var(--rv-green-tint)", color: "var(--rv-green)" },
  lost: { background: "var(--rv-red-tint)", color: "var(--rv-red)" },
};

const STATUS_PALETTE = [
  "#6b7280",
  "#b8492b",
  "#c2703a",
  "#96731f",
  "#7a8a1f",
  "#1f6d4c",
  "#0f8a8a",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#c0348e",
  "#17171a",
];

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.round(day / 7);
  if (week < 5) return `${week}w ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}

function matchesSearch(lead: Lead, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    lead.name.toLowerCase().includes(q) ||
    (lead.company ?? "").toLowerCase().includes(q) ||
    (lead.email ?? "").toLowerCase().includes(q)
  );
}

export default function CrmDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"all" | "chasing">("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<LeadStage>>(new Set());
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/leads");
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      setLeads(data.leads ?? []);
    } catch (err) {
      console.error("[CRM] fetchLeads failed:", err);
    }
  }, []);

  const fetchColumns = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/columns");
      if (!res.ok) throw new Error("Failed to fetch columns");
      const data = await res.json();
      setColumns(data.columns ?? []);
    } catch (err) {
      console.error("[CRM] fetchColumns failed:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchLeads(), fetchColumns()]).finally(() =>
      setIsLoading(false),
    );
  }, [fetchLeads, fetchColumns]);

  // Selection is scoped to the current filter — switching views/search with
  // a stale selection referencing hidden rows would be confusing.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [view, query]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenColumnIds.has(c.id)),
    [columns, hiddenColumnIds],
  );

  const gridTemplate = useMemo(() => {
    const base =
      "32px minmax(220px, 2.4fr) minmax(180px, 1.7fr) minmax(130px, 1fr) minmax(130px, 1fr)";
    const custom = visibleColumns.map(() => "minmax(130px, 1fr)").join(" ");
    return `${base}${custom ? ` ${custom}` : ""} 44px 150px`;
  }, [visibleColumns]);

  const rowMinWidth = 948 + visibleColumns.length * 130;

  const chasingCount = useMemo(() => leads.filter((l) => l.chasing).length, [leads]);

  const visibleLeads = useMemo(() => {
    const base = view === "chasing" ? leads.filter((l) => l.chasing) : leads;
    return base.filter((l) => matchesSearch(l, query));
  }, [leads, view, query]);

  const groups = useMemo(() => {
    const byStage = new Map<LeadStage, Lead[]>();
    for (const stage of LEAD_STAGES) byStage.set(stage, []);
    for (const lead of visibleLeads) byStage.get(lead.stage)?.push(lead);
    return LEAD_STAGES.map((stage) => ({ stage, leads: byStage.get(stage) ?? [] })).filter(
      // Keep "New leads" present while a draft row is open, even if empty,
      // so the draft has a group to render inside instead of floating above
      // the table.
      (g) => g.leads.length > 0 || (isAddingRow && g.stage === "cold"),
    );
  }, [visibleLeads, isAddingRow]);

  const toggleGroup = (stage: LeadStage) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const toggleChasing = async (lead: Lead) => {
    const nextChasing = !lead.chasing;
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, chasing: nextChasing } : l)),
    );
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chasing: nextChasing }),
      });
      if (!res.ok) throw new Error("Failed to update lead");
    } catch (err) {
      console.error("[CRM] toggleChasing failed:", err);
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, chasing: lead.chasing } : l)),
      );
    }
  };

  const patchLead = async (id: number, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/crm/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to update lead");
  };

  const convertToJob = async (lead: Lead) => {
    const prevStage = lead.stage;
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, stage: "won" } : l)),
    );
    try {
      await patchLead(lead.id, { stage: "won" });
    } catch (err) {
      console.error("[CRM] convertToJob failed:", err);
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, stage: prevStage } : l)),
      );
    }
  };

  const updateLeadName = async (lead: Lead, name: string) => {
    const prevName = lead.name;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, name } : l)));
    try {
      await patchLead(lead.id, { name });
    } catch (err) {
      console.error("[CRM] updateLeadName failed:", err);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, name: prevName } : l)));
    }
  };

  const updateLeadCompany = async (lead: Lead, company: string | null) => {
    const prevCompany = lead.company;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, company } : l)));
    try {
      await patchLead(lead.id, { company });
    } catch (err) {
      console.error("[CRM] updateLeadCompany failed:", err);
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, company: prevCompany } : l)),
      );
    }
  };

  const updateLeadStage = async (lead: Lead, stage: LeadStage) => {
    if (stage === lead.stage) return;
    const prevStage = lead.stage;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    try {
      await patchLead(lead.id, { stage });
    } catch (err) {
      console.error("[CRM] updateLeadStage failed:", err);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: prevStage } : l)));
    }
  };

  const setLeadCustomField = async (
    lead: Lead,
    column: CustomColumn,
    optionId: string,
  ) => {
    const key = String(column.id);
    const prevValue = lead.customFields[key] ?? "";
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? { ...l, customFields: { ...l.customFields, [key]: optionId } }
          : l,
      ),
    );
    try {
      await patchLead(lead.id, { customFields: { [key]: optionId } });
    } catch (err) {
      console.error("[CRM] setLeadCustomField failed:", err);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? { ...l, customFields: { ...l.customFields, [key]: prevValue } }
            : l,
        ),
      );
    }
  };

  const handleColumnSaved = (column: CustomColumn) => {
    setColumns((prev) => {
      const exists = prev.some((c) => c.id === column.id);
      return exists
        ? prev.map((c) => (c.id === column.id ? column : c))
        : [...prev, column];
    });
  };

  const handleColumnDeleted = (id: number) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setHiddenColumnIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setLeads((prev) =>
      prev.map((l) => {
        const key = String(id);
        if (!(key in l.customFields)) return l;
        const nextFields = { ...l.customFields };
        delete nextFields[key];
        return { ...l, customFields: nextFields };
      }),
    );
  };

  const toggleColumnVisibility = (id: number) => {
    setHiddenColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLeadCreated = (lead: Lead) => {
    setLeads((prev) => [lead, ...prev]);
    setIsAddingRow(false);
  };

  // ── Selection ──────────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectGroup = (groupLeadIds: number[]) => {
    setSelectedIds((prev) => {
      const allSelected = groupLeadIds.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of groupLeadIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds],
  );
  const canBulkConvert =
    selectedLeads.length > 0 && selectedLeads.every((l) => l.stage === "quoted");

  const bulkAddToChase = async () => {
    const targets = selectedLeads.filter((l) => !l.chasing);
    if (targets.length === 0) return;
    const ids = new Set(targets.map((l) => l.id));
    setLeads((prev) => prev.map((l) => (ids.has(l.id) ? { ...l, chasing: true } : l)));
    setSelectedIds(new Set());
    const results = await Promise.allSettled(
      targets.map((l) => patchLead(l.id, { chasing: true })),
    );
    const failedIds = new Set(
      targets.filter((_, i) => results[i].status === "rejected").map((l) => l.id),
    );
    if (failedIds.size > 0) {
      console.error("[CRM] bulkAddToChase failed for some leads:", failedIds);
      setLeads((prev) =>
        prev.map((l) => (failedIds.has(l.id) ? { ...l, chasing: false } : l)),
      );
    }
  };

  const bulkConvertToJob = async () => {
    if (!canBulkConvert) return;
    const targets = selectedLeads;
    const ids = new Set(targets.map((l) => l.id));
    setLeads((prev) => prev.map((l) => (ids.has(l.id) ? { ...l, stage: "won" } : l)));
    setSelectedIds(new Set());
    const results = await Promise.allSettled(
      targets.map((l) => patchLead(l.id, { stage: "won" })),
    );
    const failedIds = new Set(
      targets.filter((_, i) => results[i].status === "rejected").map((l) => l.id),
    );
    if (failedIds.size > 0) {
      console.error("[CRM] bulkConvertToJob failed for some leads:", failedIds);
      setLeads((prev) =>
        prev.map((l) => (failedIds.has(l.id) ? { ...l, stage: "quoted" } : l)),
      );
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>CRM</h1>
          <p className={styles.subtitle}>
            Track cold leads and move them through your pipeline
          </p>
        </div>
        <div className={styles.headTools}>
          <div className={styles.segmented}>
            <button
              className={view === "all" ? styles.segOn : ""}
              onClick={() => setView("all")}
            >
              All <b>{leads.length}</b>
            </button>
            <button
              className={view === "chasing" ? styles.segOn : ""}
              onClick={() => setView("chasing")}
            >
              Chasing <b>{chasingCount}</b>
            </button>
          </div>
          <div className={styles.search}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11.5" cy="11.5" r="9.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M22 22L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search leads"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className={styles.primary}
            onClick={() => {
              setCollapsed((prev) => {
                if (!prev.has("cold")) return prev;
                const next = new Set(prev);
                next.delete("cold");
                return next;
              });
              setIsAddingRow(true);
            }}
            disabled={isAddingRow}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New lead
          </button>
        </div>
      </div>

      {!isLoading && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarSpacer} />
          <ColumnsMenu
            columns={columns}
            hiddenColumnIds={hiddenColumnIds}
            onToggleVisibility={toggleColumnVisibility}
            onColumnSaved={handleColumnSaved}
          />
        </div>
      )}

      {isLoading ? (
        <div className={styles.groups}>
          <SkeletonGroup rows={4} />
          <SkeletonGroup rows={3} />
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.length === 0 ? (
            <div className={styles.empty}>
              {leads.length === 0
                ? "No leads yet — add your first one to get started."
                : "No leads match this filter."}
            </div>
          ) : (
            groups.map(({ stage, leads: stageLeads }) => (
              <StageGroup
                key={stage}
                stage={stage}
                leads={stageLeads}
                columns={visibleColumns}
                gridTemplate={gridTemplate}
                rowMinWidth={rowMinWidth}
                isCollapsed={collapsed.has(stage)}
                selectedIds={selectedIds}
                onToggle={() => toggleGroup(stage)}
                onSelect={setSelectedLeadId}
                onToggleChasing={toggleChasing}
                onUpdateName={updateLeadName}
                onUpdateCompany={updateLeadCompany}
                onUpdateStage={updateLeadStage}
                onSetCustomField={setLeadCustomField}
                onColumnSaved={handleColumnSaved}
                onColumnDeleted={handleColumnDeleted}
                onToggleRowSelect={toggleSelect}
                onToggleGroupSelect={toggleSelectGroup}
                onConvert={convertToJob}
                showDraftRow={isAddingRow}
                onCancelDraft={() => setIsAddingRow(false)}
                onDraftCreated={handleLeadCreated}
              />
            ))
          )}
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          canConvert={canBulkConvert}
          onChase={bulkAddToChase}
          onConvert={bulkConvertToJob}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {selectedLeadId != null && (
        <LeadDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}

// ── Stage group + table ─────────────────────────────────────────────────────

function StageGroup({
  stage,
  leads,
  columns,
  gridTemplate,
  rowMinWidth,
  isCollapsed,
  selectedIds,
  onToggle,
  onSelect,
  onToggleChasing,
  onUpdateName,
  onUpdateCompany,
  onUpdateStage,
  onSetCustomField,
  onColumnSaved,
  onColumnDeleted,
  onToggleRowSelect,
  onToggleGroupSelect,
  onConvert,
  showDraftRow,
  onCancelDraft,
  onDraftCreated,
}: {
  stage: LeadStage;
  leads: Lead[];
  columns: CustomColumn[];
  gridTemplate: string;
  rowMinWidth: number;
  isCollapsed: boolean;
  selectedIds: Set<number>;
  onToggle: () => void;
  onSelect: (id: number) => void;
  onToggleChasing: (lead: Lead) => void;
  onUpdateName: (lead: Lead, name: string) => void;
  onUpdateCompany: (lead: Lead, company: string | null) => void;
  onUpdateStage: (lead: Lead, stage: LeadStage) => void;
  onSetCustomField: (lead: Lead, column: CustomColumn, optionId: string) => void;
  onColumnSaved: (column: CustomColumn) => void;
  onColumnDeleted: (id: number) => void;
  onToggleRowSelect: (id: number) => void;
  onToggleGroupSelect: (ids: number[]) => void;
  onConvert: (lead: Lead) => void;
  showDraftRow: boolean;
  onCancelDraft: () => void;
  onDraftCreated: (lead: Lead) => void;
}) {
  const [openEditor, setOpenEditor] = useState<number | null>(null);
  const groupLeadIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const allSelected = groupLeadIds.length > 0 && groupLeadIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && groupLeadIds.some((id) => selectedIds.has(id));
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const isOpportunities = stage === "quoted";

  return (
    <div className={styles.group}>
      <button className={styles.groupHead} onClick={onToggle} type="button">
        <svg
          className={`${styles.groupChev} ${isCollapsed ? styles.groupCollapsed : ""}`}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M9 6L15 12L9 18"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className={styles.groupDot} style={{ background: STAGE_COLORS[stage] }} />
        <span className={styles.groupTitle}>{LEAD_STAGE_LABELS[stage]}</span>
        <span className={styles.groupCount}>{leads.length}</span>
      </button>

      {!isCollapsed && (
        <div className={styles.table} style={{ minWidth: rowMinWidth }}>
          <div
            className={`${styles.tr} ${styles.trHead}`}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              className={styles.checkbox}
              checked={allSelected}
              onChange={() => onToggleGroupSelect(groupLeadIds)}
              aria-label={`Select all in ${LEAD_STAGE_LABELS[stage]}`}
            />
            <span>Lead</span>
            <span>Company</span>
            <span>Status</span>
            <span>Last contact</span>
            {columns.map((col) => (
              <span key={col.id} className={styles.colHeadWrap}>
                <button
                  type="button"
                  className={styles.colHeadBtn}
                  onClick={() => setOpenEditor(openEditor === col.id ? null : col.id)}
                >
                  {col.label}
                </button>
                {openEditor === col.id && (
                  <ColumnPopover
                    column={col}
                    onClose={() => setOpenEditor(null)}
                    onSaved={(c) => {
                      onColumnSaved(c);
                      setOpenEditor(null);
                    }}
                    onDeleted={(id) => {
                      onColumnDeleted(id);
                      setOpenEditor(null);
                    }}
                  />
                )}
              </span>
            ))}
            <span>Chase</span>
            <span />
          </div>
          {stage === "cold" && showDraftRow && (
            <DraftLeadRow
              columns={columns}
              gridTemplate={gridTemplate}
              onCancel={onCancelDraft}
              onCreated={onDraftCreated}
            />
          )}
          {leads.map((lead) => (
            <div
              key={lead.id}
              className={`${styles.tr} ${styles.trBody}`}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selectedIds.has(lead.id)}
                onChange={() => onToggleRowSelect(lead.id)}
                aria-label={`Select ${lead.name}`}
              />
              <div className={styles.lead}>
                <button
                  type="button"
                  className={styles.leadAvatar}
                  onClick={() => onSelect(lead.id)}
                  title="Open"
                >
                  {initials(lead.name)}
                </button>
                <div className={styles.leadMeta}>
                  <EditableText
                    value={lead.name}
                    placeholder="Full name"
                    className={styles.leadNameEdit}
                    onSave={(v) => v && onUpdateName(lead, v)}
                  />
                </div>
              </div>
              <div className={`${styles.cell} ${!lead.company ? styles.cellMuted : ""}`}>
                <EditableText
                  value={lead.company ?? ""}
                  placeholder="Company"
                  onSave={(v) => onUpdateCompany(lead, v.trim() || null)}
                />
              </div>
              <StagePill lead={lead} onChange={(next) => onUpdateStage(lead, next)} />
              <div className={`${styles.cell} ${styles.cellMuted}`}>
                {timeAgo(lead.updatedAt)}
              </div>
              {columns.map((col) => (
                <StatusCell
                  key={col.id}
                  column={col}
                  valueId={lead.customFields[String(col.id)]}
                  onChange={(optionId) => onSetCustomField(lead, col, optionId)}
                />
              ))}
              <button
                className={`${styles.star} ${lead.chasing ? styles.starOn : ""}`}
                title={lead.chasing ? "Stop chasing" : "Chase this lead"}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChasing(lead);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={lead.chasing ? "currentColor" : "none"}
                >
                  <path
                    d="M12 2L14.6 8.6L21.5 9.3L16.3 13.9L17.9 20.7L12 17.1L6.1 20.7L7.7 13.9L2.5 9.3L9.4 8.6L12 2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {isOpportunities ? (
                <button
                  type="button"
                  className={styles.convert}
                  onClick={(e) => {
                    e.stopPropagation();
                    onConvert(lead);
                  }}
                >
                  Convert to job
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editable text cell (Monday-style click-to-edit) ──────────────────────────

function EditableText({
  value,
  placeholder,
  onSave,
  className,
}: {
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={styles.cellEditInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={`${styles.cellEditTrigger} ${className ?? ""}`}
      onClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
    >
      {value || <span className={styles.cellPlaceholder}>{placeholder}</span>}
    </button>
  );
}

// ── Stage pill (click-to-edit, same dropdown pattern as StatusCell) ──────────

function StagePill({
  lead,
  onChange,
}: {
  lead: Lead;
  onChange: (stage: LeadStage) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={styles.statusCellWrap} ref={ref}>
      <button
        type="button"
        className={styles.statusPillBtn}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className={styles.stagePill} style={STAGE_PILL_STYLE[lead.stage]}>
          {LEAD_STAGE_LABELS[lead.stage]}
        </span>
      </button>
      {open && (
        <div className={styles.statusMenu} onClick={(e) => e.stopPropagation()}>
          {LEAD_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.statusMenuItem}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              <span className={styles.stagePill} style={STAGE_PILL_STYLE[s]}>
                {LEAD_STAGE_LABELS[s]}
              </span>
              {s === lead.stage && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12L9 17L20 6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bulk action bar ──────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  canConvert,
  onChase,
  onConvert,
  onClear,
}: {
  count: number;
  canConvert: boolean;
  onChase: () => void;
  onConvert: () => void;
  onClear: () => void;
}) {
  return (
    <div className={styles.bulkBar}>
      <span className={styles.bulkBarCount}>{count} selected</span>
      <div className={styles.bulkBarActions}>
        <button type="button" className={styles.bulkBarBtn} onClick={onChase}>
          Add to chase
        </button>
        {canConvert && (
          <button type="button" className={styles.bulkBarBtn} onClick={onConvert}>
            Convert to job
          </button>
        )}
      </div>
      <button
        type="button"
        className={styles.bulkBarClose}
        onClick={onClear}
        aria-label="Clear selection"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ── Columns menu (show/hide + add) ───────────────────────────────────────────

function ColumnsMenu({
  columns,
  hiddenColumnIds,
  onToggleVisibility,
  onColumnSaved,
}: {
  columns: CustomColumn[];
  hiddenColumnIds: Set<number>;
  onToggleVisibility: (id: number) => void;
  onColumnSaved: (column: CustomColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visibleCount = columns.length - hiddenColumnIds.size;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={styles.colmenu} ref={ref}>
      <button
        type="button"
        className={styles.colmenuBtn}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 4V20M15 4V20" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        Columns <b>{visibleCount}</b>
      </button>
      {open && (
        <div className={styles.colmenuPop}>
          <div className={styles.colmenuHead}>
            <span>Columns in this table</span>
            <button
              type="button"
              className={styles.colmenuClose}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {showAdd ? (
            <ColumnPopover
              inline
              onClose={() => setShowAdd(false)}
              onSaved={(c) => {
                onColumnSaved(c);
                setShowAdd(false);
              }}
              onDeleted={() => {}}
            />
          ) : (
            <div className={styles.colmenuList}>
              {columns.length === 0 && (
                <p className={styles.colmenuEmpty}>No custom columns yet.</p>
              )}
              {columns.map((col) => {
                const isOn = !hiddenColumnIds.has(col.id);
                return (
                  <div
                    key={col.id}
                    className={`${styles.colmenuRow} ${isOn ? styles.colmenuRowOn : ""}`}
                    onClick={() => onToggleVisibility(col.id)}
                    role="checkbox"
                    aria-checked={isOn}
                    tabIndex={0}
                  >
                    <div className={styles.colmenuTick}>
                      {isOn && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 13L9 17L19 7"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className={styles.colmenuLabel}>{col.label}</span>
                    <span className={styles.colmenuType}>status</span>
                  </div>
                );
              })}
              <button
                type="button"
                className={styles.colmenuAddRow}
                onClick={() => setShowAdd(true)}
              >
                + Add column
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Status cell (custom column value) ───────────────────────────────────────

function StatusCell({
  column,
  valueId,
  onChange,
}: {
  column: CustomColumn;
  valueId?: string;
  onChange: (optionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = column.options.find((o) => o.id === valueId);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={styles.statusCellWrap} ref={ref}>
      <button
        type="button"
        className={styles.statusPillBtn}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {selected ? (
          <span
            className={styles.statusPill}
            style={{ background: `${selected.color}1c`, color: selected.color }}
          >
            {selected.label}
          </span>
        ) : (
          <span className={styles.statusPillEmpty}>—</span>
        )}
      </button>
      {open && (
        <div className={styles.statusMenu} onClick={(e) => e.stopPropagation()}>
          {column.options.length === 0 ? (
            <span className={styles.statusMenuEmpty}>No options yet</span>
          ) : (
            column.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={styles.statusMenuItem}
                onClick={() => {
                  onChange(opt.id === valueId ? "" : opt.id);
                  setOpen(false);
                }}
              >
                <span
                  className={styles.statusPill}
                  style={{ background: `${opt.color}1c`, color: opt.color }}
                >
                  {opt.label}
                </span>
                {opt.id === valueId && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 12L9 17L20 6"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Column add/edit popover ──────────────────────────────────────────────────

function ColumnPopover({
  column,
  inline = false,
  onClose,
  onSaved,
  onDeleted,
}: {
  column?: CustomColumn;
  /** Renders flush inside its parent (e.g. the Columns menu) instead of as
   *  an absolutely-positioned popover of its own. */
  inline?: boolean;
  onClose: () => void;
  onSaved: (column: CustomColumn) => void;
  onDeleted: (id: number) => void;
}) {
  const [label, setLabel] = useState(column?.label ?? "");
  const [options, setOptions] = useState<CustomColumnOption[]>(
    column?.options ?? [{ id: genId(), label: "", color: STATUS_PALETTE[0] }],
  );
  const [openSwatchFor, setOpenSwatchFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const updateOption = (id: string, patch: Partial<CustomColumnOption>) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const addOption = () => {
    const used = new Set(options.map((o) => o.color));
    const nextColor =
      STATUS_PALETTE.find((c) => !used.has(c)) ??
      STATUS_PALETTE[options.length % STATUS_PALETTE.length];
    setOptions((prev) => [...prev, { id: genId(), label: "", color: nextColor }]);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      setError("Column name is required.");
      return;
    }
    const cleanOptions = options
      .map((o) => ({ ...o, label: o.label.trim() }))
      .filter((o) => o.label);
    if (cleanOptions.length === 0) {
      setError("Add at least one option.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        column ? `/api/crm/columns/${column.id}` : "/api/crm/columns",
        {
          method: column ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: label.trim(), options: cleanOptions }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save column");
      }
      const data = await res.json();
      onSaved(data.column);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save column");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!column) return;
    if (!window.confirm(`Delete the "${column.label}" column? This can't be undone.`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/columns/${column.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete column");
      onDeleted(column.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete column");
      setSaving(false);
    }
  };

  return (
    <div
      className={`${styles.colPopover} ${inline ? styles.colPopoverInline : ""}`}
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        className={styles.colPopoverName}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Column name"
        autoFocus
        disabled={saving}
      />
      <div className={styles.colPopoverOptions}>
        {options.map((opt) => (
          <div key={opt.id} className={styles.colPopoverOption}>
            <div className={styles.swatchWrap}>
              <button
                type="button"
                className={styles.swatch}
                style={{ background: opt.color }}
                onClick={() => setOpenSwatchFor(openSwatchFor === opt.id ? null : opt.id)}
                aria-label="Choose colour"
              />
              {openSwatchFor === opt.id && (
                <div className={styles.swatchGrid}>
                  {STATUS_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={styles.swatchCell}
                      style={{ background: c }}
                      onClick={() => {
                        updateOption(opt.id, { color: c });
                        setOpenSwatchFor(null);
                      }}
                      aria-label={c}
                    />
                  ))}
                </div>
              )}
            </div>
            <input
              className={styles.colPopoverOptionInput}
              value={opt.label}
              onChange={(e) => updateOption(opt.id, { label: e.target.value })}
              placeholder="Option label"
              disabled={saving}
            />
            <button
              type="button"
              className={styles.colPopoverRemove}
              onClick={() => removeOption(opt.id)}
              aria-label="Remove option"
              disabled={saving}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6L18 18M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.colPopoverAddOption}
          onClick={addOption}
          disabled={saving}
        >
          + Add option
        </button>
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.colPopoverActions}>
        {column ? (
          <button
            type="button"
            className={styles.colPopoverDelete}
            onClick={handleDelete}
            disabled={saving}
          >
            Delete column
          </button>
        ) : (
          <span />
        )}
        <div className={styles.colPopoverActionsRight}>
          <button
            type="button"
            className={styles.colPopoverCancel}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.colPopoverSave}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

const SKELETON_GRID =
  "32px minmax(220px, 2.4fr) minmax(180px, 1.7fr) minmax(130px, 1fr) minmax(130px, 1fr) 44px 150px";

function SkeletonGroup({ rows }: { rows: number }) {
  return (
    <div className={styles.group}>
      <div className={styles.skelGroupHead}>
        <span className={`${styles.skelBar} ${styles.groupDot}`} />
        <span className={styles.skelBar} style={{ width: 70, height: 11 }} />
        <span className={styles.skelBar} style={{ width: 16, height: 11 }} />
      </div>
      <div className={styles.table} style={{ minWidth: 948 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.tr} style={{ gridTemplateColumns: SKELETON_GRID }}>
            <span />
            <div className={styles.lead}>
              <span className={`${styles.skelBar} ${styles.skelAvatar}`} />
              <div className={styles.leadMeta}>
                <span className={styles.skelBar} style={{ width: "70%", height: 12 }} />
              </div>
            </div>
            <span className={styles.skelBar} style={{ width: "70%", height: 11 }} />
            <span className={styles.skelBar} style={{ width: "60%", height: 18, borderRadius: 7 }} />
            <span className={styles.skelBar} style={{ width: "50%", height: 11 }} />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline "new lead" draft row ──────────────────────────────────────────────
// Rendered as the first row inside the "New leads" group's own table, styled
// identically to a real row (no tint, no save/cancel buttons) — you just
// type a name. Committing it (Enter or blur) with a non-empty name creates
// the lead immediately and the row becomes a normal, fully-editable row from
// then on; committing empty discards it. Company/Status/Chase aren't
// editable yet at this point — there's no lead to attach them to until the
// name is committed.

function DraftLeadRow({
  columns,
  gridTemplate,
  onCancel,
  onCreated,
}: {
  columns: CustomColumn[];
  gridTemplate: string;
  onCancel: () => void;
  onCreated: (lead: Lead) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const commit = useCallback(async () => {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, stage: "cold" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create lead");
      }
      const data = await res.json();
      onCreated(data.lead);
    } catch (err) {
      console.error("[CRM] createLead failed:", err);
      setSaving(false);
    }
  }, [saving, name, onCancel, onCreated]);

  return (
    <div className={`${styles.tr} ${styles.trBody}`} style={{ gridTemplateColumns: gridTemplate }}>
      <span />
      <div className={styles.lead}>
        <div className={styles.leadAvatar}>{initials(name)}</div>
        <input
          ref={nameRef}
          className={styles.cellEditInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="Full name"
          disabled={saving}
        />
      </div>
      <div className={`${styles.cell} ${styles.cellMuted}`}>Company</div>
      <div className={styles.cell}>
        <span className={styles.stagePill} style={STAGE_PILL_STYLE.cold}>
          {LEAD_STAGE_LABELS.cold}
        </span>
      </div>
      <div className={`${styles.cell} ${styles.cellMuted}`}>—</div>
      {columns.map((col) => (
        <span key={col.id} className={`${styles.cell} ${styles.cellMuted}`}>
          —
        </span>
      ))}
      <span />
      <span />
    </div>
  );
}
