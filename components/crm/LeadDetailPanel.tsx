"use client";
// components/crm/LeadDetailPanel.tsx
//
// Editable lead fields, a stage dropdown that saves immediately (moving a
// lead through the pipeline is a discrete, deliberate action — no separate
// "save" step needed for that one), a merged activity timeline (notes,
// stage changes, email log), and a quick-note form + send-email action.

import React, { useCallback, useEffect, useState } from "react";
import styles from "./LeadDetailPanel.module.css";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import TextArea from "@/components/ui/TextArea";
import ComposeEmailModal from "./ComposeEmailModal";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type Lead,
  type LeadActivity,
  type LeadStage,
} from "@/lib/crm/store";

interface LeadDetailPanelProps {
  leadId: number;
  onClose: () => void;
  /** Called after any change that the leads list needs to reflect (stage, fields). */
  onChanged: () => void;
}

export default function LeadDetailPanel({
  leadId,
  onClose,
  onChanged,
}: LeadDetailPanelProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [activity, setActivity] = useState<LeadActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  // Editable contact-field draft — separate from `lead` so typing doesn't
  // flicker the header/stage dropdown, and so Save is a deliberate action.
  const [draft, setDraft] = useState({ name: "", company: "", email: "", phone: "" });
  const [savingFields, setSavingFields] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`);
      if (!res.ok) throw new Error("Failed to fetch lead");
      const data = await res.json();
      setLead(data.lead);
      setActivity(data.activity ?? []);
      setDraft({
        name: data.lead.name ?? "",
        company: data.lead.company ?? "",
        email: data.lead.email ?? "",
        phone: data.lead.phone ?? "",
      });
    } catch (err) {
      console.error("[CRM] fetchLead failed:", err);
      setError("Failed to load this lead.");
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const handleStageChange = async (stage: LeadStage) => {
    if (!lead || stage === lead.stage) return;
    setSavingStage(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      const data = await res.json();
      setLead(data.lead);
      onChanged();
      fetchLead(); // pick up the new stage_change activity row
    } catch (err) {
      console.error("[CRM] stage update failed:", err);
      setError("Failed to update stage.");
    } finally {
      setSavingStage(false);
    }
  };

  const handleSaveFields = async () => {
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSavingFields(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          company: draft.company.trim() || null,
          email: draft.email.trim() || null,
          phone: draft.phone.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save lead");
      const data = await res.json();
      setLead(data.lead);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lead");
    } finally {
      setSavingFields(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNoteBody("");
      fetchLead();
    } catch (err) {
      console.error("[CRM] addNote failed:", err);
      setError("Failed to add note.");
    } finally {
      setSavingNote(false);
    }
  };

  if (isLoading || !lead) {
    return (
      <Modal isOpen onClose={onClose} title="Lead">
        <p className={styles.loading}>Loading…</p>
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen onClose={onClose} title={lead.name}>
        <div className={styles.panel}>
          <div className={styles.fieldGrid}>
            <TextInput
              id="detail-name"
              label="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <TextInput
              id="detail-company"
              label="Company"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
            <TextInput
              id="detail-email"
              label="Email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <TextInput
              id="detail-phone"
              label="Phone"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </div>

          <div className={styles.stageRow}>
            <label className={styles.stageLabel} htmlFor="detail-stage">
              Stage
            </label>
            <select
              id="detail-stage"
              className={styles.stageSelect}
              value={lead.stage}
              disabled={savingStage}
              onChange={(e) => handleStageChange(e.target.value as LeadStage)}
            >
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {LEAD_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actionsRow}>
            <Button variant="secondary" size="sm" onClick={handleSaveFields} disabled={savingFields}>
              {savingFields ? "Saving…" : "Save Details"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCompose(true)}
              disabled={!lead.email}
            >
              Send Email
            </Button>
          </div>

          <div className={styles.timelineSection}>
            <div className={styles.timelineHeader}>Activity</div>

            <div className={styles.noteForm}>
              <TextArea
                id="detail-note"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Log a call, add a note…"
                rows={2}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddNote}
                disabled={savingNote || !noteBody.trim()}
              >
                {savingNote ? "Adding…" : "Add Note"}
              </Button>
            </div>

            <div className={styles.timeline}>
              {activity.length === 0 && (
                <p className={styles.timelineEmpty}>No activity yet.</p>
              )}
              {activity.map((a) => (
                <ActivityRow key={a.id} activity={a} />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {showCompose && lead.email && (
        <ComposeEmailModal
          leadId={lead.id}
          leadEmail={lead.email}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            fetchLead();
          }}
        />
      )}
    </>
  );
}

function ActivityRow({ activity }: { activity: LeadActivity }) {
  const time = new Date(activity.createdAt).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  if (activity.type === "stage_change") {
    return (
      <div className={styles.timelineRow}>
        <span className={styles.timelineDot} />
        <div className={styles.timelineBody}>
          <div className={styles.timelineText}>{activity.body}</div>
          <div className={styles.timelineTime}>{time}</div>
        </div>
      </div>
    );
  }

  if (activity.type === "email") {
    return (
      <div className={styles.timelineRow}>
        <span className={styles.timelineDot} />
        <div className={styles.timelineBody}>
          <div className={styles.timelineText}>
            Email: <strong>{activity.subject}</strong>
          </div>
          <div className={styles.timelineTime}>
            {time} · {emailStatusLabel(activity)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.timelineRow}>
      <span className={styles.timelineDot} />
      <div className={styles.timelineBody}>
        <div className={styles.timelineText}>{activity.body}</div>
        <div className={styles.timelineTime}>{time}</div>
      </div>
    </div>
  );
}

function emailStatusLabel(activity: LeadActivity): string {
  if (activity.bouncedAt) return "Bounced";
  if (activity.clickedAt) return "Clicked";
  if (activity.openedAt) return "Opened";
  if (activity.deliveredAt) return "Delivered";
  if (activity.emailStatus === "sent") return "Sent";
  if (activity.emailStatus === "failed") return "Failed to send";
  return "Sending…";
}
