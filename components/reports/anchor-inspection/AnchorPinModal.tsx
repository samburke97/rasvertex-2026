"use client";
// components/reports/anchor-inspection/AnchorPinModal.tsx
//
// Tap a pin to fix it up: asset number, result and what it is. Dates come
// from the job and rarely differ per anchor, so they sit behind "Dates".

import React, { useState } from "react";
import styles from "./AnchorPinModal.module.css";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import {
  ANCHOR_SUBTYPE_LABELS,
  ANCHOR_TYPE_OPTIONS,
  ANCHOR_TYPE_SUBTYPES,
  anchorIconName,
  type AnchorPoint,
  type AnchorSubtype,
  type AnchorType,
  type PassFail,
} from "@/lib/reports/anchor.types";

interface AnchorPinModalProps {
  anchor: AnchorPoint;
  isNew: boolean;
  onSave: (anchor: AnchorPoint) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// Every type, and every type + mount, as one flat list for a single select.
const KIND_OPTIONS = ANCHOR_TYPE_OPTIONS.flatMap(({ value, label }) => {
  const subs = ANCHOR_TYPE_SUBTYPES[value];
  return subs
    ? subs.map((st) => ({ value: `${value}:${st}`, label: `${label} – ${ANCHOR_SUBTYPE_LABELS[st]}` }))
    : [{ value, label }];
});

export default function AnchorPinModal({
  anchor,
  isNew,
  onSave,
  onDelete,
  onClose,
}: AnchorPinModalProps) {
  const [form, setForm] = useState<AnchorPoint>({ ...anchor });
  const [showDates, setShowDates] = useState(false);

  const set = <K extends keyof AnchorPoint>(key: K, val: AnchorPoint[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const kind = form.subtype ? `${form.type}:${form.subtype}` : form.type;
  const setKind = (v: string) => {
    const [type, subtype] = v.split(":") as [AnchorType, AnchorSubtype | undefined];
    setForm((prev) => ({ ...prev, type, subtype }));
  };

  const handleSave = () => {
    if (!form.label.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isNew ? "Add anchor" : form.label}
      icon={
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/reports/anchor/icons/${anchorIconName(form)}.svg`} alt="" width={20} height={20} />
      }
    >
      <div className={styles.grid2}>
        <TextInput
          id="anchor-label"
          label="Asset #"
          value={form.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="e.g. A26"
        />

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Result</label>
          <div className={styles.resultToggle}>
            {(["PASSED", "FAILED"] as PassFail[]).map((r) => (
              <button
                key={r}
                className={`${styles.resultBtn} ${
                  form.result === r
                    ? r === "PASSED"
                      ? styles.resultBtnPass
                      : styles.resultBtnFail
                    : ""
                }`}
                onClick={() => set("result", r)}
              >
                {r === "PASSED" ? "Passed" : "Failed"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="anchor-kind">
          Type
        </label>
        {/* Legacy anchors with no mount yet still show their plain type. */}
        <select
          id="anchor-kind"
          className={styles.select}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {!KIND_OPTIONS.some((o) => o.value === kind) && (
            <option value={kind}>{ANCHOR_TYPE_OPTIONS.find((o) => o.value === form.type)?.label}</option>
          )}
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {showDates ? (
        <div className={styles.grid2}>
          <TextInput
            id="anchor-inspection-date"
            label="Inspected"
            value={form.inspectionDate}
            onChange={(e) => set("inspectionDate", e.target.value)}
            placeholder="05.06.2026"
          />
          <TextInput
            id="anchor-next-inspection"
            label="Next inspection"
            value={form.nextInspection}
            onChange={(e) => set("nextInspection", e.target.value)}
            placeholder="05.06.2027"
          />
        </div>
      ) : (
        <button type="button" className={styles.datesLink} onClick={() => setShowDates(true)}>
          Dates: {form.inspectionDate || "—"} → {form.nextInspection || "—"} · Change
        </button>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        {!isNew && (
          <button className={styles.deleteBtn} onClick={() => onDelete(form.id)}>
            Remove
          </button>
        )}
        <div className={styles.footerRight}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!form.label.trim()}
          >
            {isNew ? "Add" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
