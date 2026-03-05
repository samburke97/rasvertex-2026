"use client";
// components/reports/anchor-inspection/AnchorPinModal.tsx

import React, { useState } from "react";
import styles from "./AnchorPinModal.module.css";
import Button from "@/components/ui/Button";
import {
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_OPTIONS,
  type AnchorPoint,
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

export default function AnchorPinModal({
  anchor,
  isNew,
  onSave,
  onDelete,
  onClose,
}: AnchorPinModalProps) {
  const [form, setForm] = useState<AnchorPoint>({ ...anchor });

  const set = <K extends keyof AnchorPoint>(key: K, val: AnchorPoint[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.label.trim()) return;
    onSave(form);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div
            className={styles.typeIndicator}
            style={{ background: ANCHOR_TYPE_COLOURS[form.type] }}
          />
          <h3 className={styles.title}>
            {isNew ? "Add Anchor Point" : `Edit — ${form.label}`}
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Type selector */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Asset Type</label>
            <div className={styles.typeGrid}>
              {ANCHOR_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.typeBtn} ${
                    form.type === opt.value ? styles.typeBtnActive : ""
                  }`}
                  style={
                    form.type === opt.value
                      ? {
                          borderColor: ANCHOR_TYPE_COLOURS[opt.value],
                          background: ANCHOR_TYPE_COLOURS[opt.value] + "18",
                          color: ANCHOR_TYPE_COLOURS[opt.value],
                        }
                      : {}
                  }
                  onClick={() => set("type", opt.value as AnchorType)}
                >
                  <span
                    className={styles.typeDot}
                    style={{ background: ANCHOR_TYPE_COLOURS[opt.value] }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Two column grid */}
          <div className={styles.grid2}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Asset Label</label>
              <input
                className={styles.input}
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="e.g. A.26"
              />
            </div>

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
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Model / Serial</label>
              <input
                className={styles.input}
                value={form.model ?? ""}
                onChange={(e) => set("model", e.target.value)}
                placeholder="ASSAN001038"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Manufacturer</label>
              <input
                className={styles.input}
                value={form.manufacturer ?? ""}
                onChange={(e) => set("manufacturer", e.target.value)}
                placeholder="e.g. Safetylyne"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Commission Date</label>
              <input
                className={styles.input}
                value={form.commissionDate ?? ""}
                onChange={(e) => set("commissionDate", e.target.value)}
                placeholder="01 Jul 2017"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Major Service Date</label>
              <input
                className={styles.input}
                value={form.majorServiceDate ?? ""}
                onChange={(e) => set("majorServiceDate", e.target.value)}
                placeholder="01 Jul 2027"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Inspection Date</label>
              <input
                className={styles.input}
                value={form.inspectionDate}
                onChange={(e) => set("inspectionDate", e.target.value)}
                placeholder="07 Jan 2026"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Next Inspection</label>
              <input
                className={styles.input}
                value={form.nextInspection}
                onChange={(e) => set("nextInspection", e.target.value)}
                placeholder="07 Jan 2027"
              />
            </div>
          </div>

          {/* Notes */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Notes</label>
            <textarea
              className={styles.textarea}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any observations or remarks…"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {!isNew && (
            <button
              className={styles.deleteBtn}
              onClick={() => {
                if (confirm("Remove this anchor?")) onDelete(form.id);
              }}
            >
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
              {isNew ? "Add Anchor" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
