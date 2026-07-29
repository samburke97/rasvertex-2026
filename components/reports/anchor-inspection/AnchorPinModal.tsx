"use client";
// components/reports/anchor-inspection/AnchorPinModal.tsx

import React, { useState } from "react";
import styles from "./AnchorPinModal.module.css";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import {
  ANCHOR_SUBTYPE_LABELS,
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_OPTIONS,
  ANCHOR_TYPE_SUBTYPES,
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

  const setType = (type: AnchorType) => {
    const subtypes = ANCHOR_TYPE_SUBTYPES[type];
    setForm((prev) => ({ ...prev, type, subtype: subtypes?.[0] }));
  };

  const subtypeOptions = ANCHOR_TYPE_SUBTYPES[form.type];

  const handleSave = () => {
    if (!form.label.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isNew ? "Add Anchor Point" : `Edit — ${form.label}`}
      icon={
        <span
          className={styles.typeIndicator}
          style={{ background: ANCHOR_TYPE_COLOURS[form.type] }}
        />
      }
    >
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
              onClick={() => setType(opt.value as AnchorType)}
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

      {/* Mount type — only for anchor types with sub-options */}
      {subtypeOptions && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Mount Type</label>
          <div className={styles.typeGrid}>
            {subtypeOptions.map((st) => (
              <button
                key={st}
                type="button"
                className={`${styles.typeBtn} ${
                  form.subtype === st ? styles.typeBtnActive : ""
                }`}
                style={
                  form.subtype === st
                    ? {
                        borderColor: ANCHOR_TYPE_COLOURS[form.type],
                        background: ANCHOR_TYPE_COLOURS[form.type] + "18",
                        color: ANCHOR_TYPE_COLOURS[form.type],
                      }
                    : {}
                }
                onClick={() => set("subtype", st)}
              >
                {ANCHOR_SUBTYPE_LABELS[st]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two column grid */}
      <div className={styles.grid2}>
        <TextInput
          id="anchor-label"
          label="Asset #"
          value={form.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="e.g. A.26"
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
                {r}
              </button>
            ))}
          </div>
        </div>

        <TextInput
          id="anchor-commission-date"
          label="Commission Date"
          value={form.commissionDate ?? ""}
          onChange={(e) => set("commissionDate", e.target.value)}
          placeholder="01 Jul 2017"
        />

        <TextInput
          id="anchor-inspection-date"
          label="Inspection Date"
          value={form.inspectionDate}
          onChange={(e) => set("inspectionDate", e.target.value)}
          placeholder="07 Jan 2026"
        />

        <TextInput
          id="anchor-next-inspection"
          label="Next Inspection"
          value={form.nextInspection}
          onChange={(e) => set("nextInspection", e.target.value)}
          placeholder="07 Jan 2027"
        />
      </div>

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
            {isNew ? "Add Anchor" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
