"use client";
// components/crm/CrmDashboard.tsx
//
// Leads list + stage filter + add-lead. Fetches the full list once (plain
// useState/fetch, matching ReportSelector.tsx's idiom — no data-fetching
// library exists in this app) and filters client-side by stage, since a
// small business's lead count doesn't warrant a round trip per filter click.

import React, { useCallback, useEffect, useState } from "react";
import styles from "./CrmDashboard.module.css";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import LeadDetailPanel from "./LeadDetailPanel";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type Lead,
  type LeadStage,
} from "@/lib/crm/store";

const STAGE_COLORS: Record<LeadStage, string> = {
  cold: "#6b7280",
  contacted: "#2563eb",
  qualified: "#7c3aed",
  quoted: "#d97706",
  won: "#16a34a",
  lost: "#dc2626",
};

function StageBadge({ stage }: { stage: LeadStage }) {
  const color = STAGE_COLORS[stage];
  return (
    <span
      className={styles.stageBadge}
      style={{ color, background: `${color}1a`, borderColor: `${color}40` }}
    >
      {LEAD_STAGE_LABELS[stage]}
    </span>
  );
}

export default function CrmDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/leads");
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      setLeads(data.leads ?? []);
    } catch (err) {
      console.error("[CRM] fetchLeads failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads =
    stageFilter === "all" ? leads : leads.filter((l) => l.stage === stageFilter);

  const columns: Column<Lead>[] = [
    { key: "name", header: "Name" },
    {
      key: "company",
      header: "Company",
      render: (row) => row.company || "—",
    },
    { key: "email", header: "Email", render: (row) => row.email || "—" },
    { key: "phone", header: "Phone", render: (row) => row.phone || "—" },
    {
      key: "stage",
      header: "Stage",
      render: (row) => <StageBadge stage={row.stage} />,
      width: "140px",
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (row) => new Date(row.updatedAt).toLocaleDateString("en-AU"),
      width: "120px",
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>CRM</h1>
          <p className={styles.subtitle}>
            Track cold leads and move them through your pipeline
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
          Add Lead
        </Button>
      </div>

      <div className={styles.stageTabs}>
        <button
          className={`${styles.stageTab} ${stageFilter === "all" ? styles.stageTabActive : ""}`}
          onClick={() => setStageFilter("all")}
        >
          All <span className={styles.stageTabCount}>{leads.length}</span>
        </button>
        {LEAD_STAGES.map((stage) => (
          <button
            key={stage}
            className={`${styles.stageTab} ${stageFilter === stage ? styles.stageTabActive : ""}`}
            onClick={() => setStageFilter(stage)}
          >
            {LEAD_STAGE_LABELS[stage]}{" "}
            <span className={styles.stageTabCount}>
              {leads.filter((l) => l.stage === stage).length}
            </span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filteredLeads}
        keyField="id"
        isLoading={isLoading}
        emptyMessage="No leads yet — add your first one to get started."
        itemsPerPage={25}
        onRowClick={(row) => setSelectedLeadId(row.id)}
      />

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            fetchLeads();
          }}
        />
      )}

      {selectedLeadId != null && (
        <LeadDetailPanel
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onChanged={fetchLeads}
        />
      )}
    </div>
  );
}

// ── Add Lead modal ────────────────────────────────────────────────────────────

function AddLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create lead");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Add Lead">
      <div className={styles.form}>
        <TextInput
          id="lead-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          autoFocus
          required
        />
        <TextInput
          id="lead-company"
          label="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company name"
        />
        <TextInput
          id="lead-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
        />
        <TextInput
          id="lead-phone"
          label="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="04xx xxx xxx"
        />
        {error && <p className={styles.formError}>{error}</p>}
        <div className={styles.formActions}>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Add Lead"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
