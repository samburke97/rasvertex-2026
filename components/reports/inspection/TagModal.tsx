"use client";
// components/reports/inspection/TagModal.tsx
//
// Tag photos without typing label syntax: pick the zone, level, optional
// unit and defect codes, add a note — the label (D10 L2 SH LF - note) is
// built from those. Steps through a queue of photos; Save & next moves on.

import { useEffect, useMemo, useState } from "react";
import styles from "./TagModal.module.css";
import { BANDS, BAND_ORDER, type Library } from "@/lib/reports/inspection/codes";
import { parseLabel, photoLabel, type InspectionPhoto } from "@/lib/reports/inspection/types";

interface Props {
  photos: InspectionPhoto[];
  lib: Library;
  /** Zones already used in this report, offered as quick picks. */
  zones: string[];
  onSave: (id: string, label: string) => void;
  onClose: () => void;
}

interface Tag {
  zone: string;
  level: string;
  unit: string;
  codes: string[];
  note: string;
}

const LEVELS: [string, string][] = [
  ["LG", "Ground"],
  ["L1", "1"],
  ["L2", "2"],
  ["L3", "3"],
  ["L4", "4"],
  ["L5", "5"],
  ["L6", "6"],
  ["LR", "Roof"],
];

// Reads whatever parts of a label are there, valid label or not.
function readTag(label: string, lib: Library): Tag {
  const split = label.indexOf(" - ");
  const head = split >= 0 ? label.slice(0, split) : label;
  const tag: Tag = { zone: "", level: "", unit: "", codes: [], note: split >= 0 ? label.slice(split + 3).trim() : "" };
  for (const tok of head.toUpperCase().split(/\s+/).filter(Boolean)) {
    if (/^[DS]\d+$/.test(tok) && !tag.zone) tag.zone = tok;
    else if (/^L(\d+|G|R)$/.test(tok) && !tag.level) tag.level = tok;
    else if (/^U\d+$/.test(tok) && !tag.unit) tag.unit = tok.slice(1);
    else if (lib.codeMap[tok] && !tag.codes.includes(tok)) tag.codes.push(tok);
  }
  return tag;
}

function buildLabel(t: Tag): string {
  const head = [t.zone, t.level, t.unit ? "U" + t.unit : "", ...t.codes].filter(Boolean).join(" ");
  return t.note.trim() ? `${head} - ${t.note.trim()}` : head;
}

export default function TagModal({ photos, lib, zones, onSave, onClose }: Props) {
  const [i, setI] = useState(0);
  const photo = photos[i];
  const [tag, setTag] = useState<Tag>(() => readTag(photos[0] ? photoLabel(photos[0]) : "", lib));
  const [zoneKind, setZoneKind] = useState<"D" | "S">("D");

  useEffect(() => {
    if (!photo) return;
    const t = readTag(photoLabel(photo), lib);
    // A fresh photo (no zone yet) keeps the last zone and level — photos
    // are usually tagged a drop at a time.
    setTag((prev) => (t.zone ? t : { ...t, zone: prev.zone, level: t.level || prev.level }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    if (tag.zone) setZoneKind(tag.zone[0] as "D" | "S");
  }, [tag.zone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const label = buildLabel(tag);
  const result = useMemo(() => parseLabel(label, lib), [label, lib]);
  const valid = result.kind === "photo";
  const set = (patch: Partial<Tag>) => setTag((t) => ({ ...t, ...patch }));
  const toggle = (code: string) =>
    set({ codes: tag.codes.includes(code) ? tag.codes.filter((c) => c !== code) : [...tag.codes, code] });

  const next = () => (i < photos.length - 1 ? setI(i + 1) : onClose());
  const save = () => {
    if (!valid) return;
    onSave(photo.id, label);
    next();
  };

  if (!photo) return null;
  const zoneNum = tag.zone ? tag.zone.slice(1) : "";
  const quickZones = zones.filter((z) => z[0] === zoneKind);
  const codeGroups = BAND_ORDER.map((band) => ({
    band,
    codes: lib.codes.filter((c) => c.band === band && !c.system),
  }));
  const systemCodes = lib.codes.filter((c) => c.system);

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-label="Tag photo">
        <div className={styles.photoCol}>
          <div className={styles.photo} style={{ backgroundImage: `url("${photo.url}")` }} />
          <div className={styles.fileName} title={photo.name}>
            {photo.name}
          </div>
        </div>

        <div className={styles.form}>
          <div className={styles.head}>
            <div className={styles.title}>Tag photo</div>
            {photos.length > 1 && (
              <div className={styles.count}>
                {i + 1} of {photos.length}
              </div>
            )}
            <button className={styles.close} onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className={styles.scroll}>
            <div className={styles.field}>
              <span className={styles.label}>Zone</span>
              <div className={styles.row}>
                <div className={styles.seg}>
                  {(["D", "S"] as const).map((k) => (
                    <button
                      key={k}
                      className={`${styles.segBtn} ${zoneKind === k ? styles.segOn : ""}`}
                      onClick={() => {
                        setZoneKind(k);
                        set({ zone: zoneNum ? k + zoneNum : "" });
                      }}
                    >
                      {k === "D" ? "Drop" : "Section"}
                    </button>
                  ))}
                </div>
                <input
                  className={styles.numInput}
                  inputMode="numeric"
                  placeholder="#"
                  value={zoneNum}
                  autoFocus
                  onChange={(e) => {
                    const n = e.target.value.replace(/\D/g, "");
                    set({ zone: n ? zoneKind + n : "" });
                  }}
                />
                {quickZones.map((z) => (
                  <button
                    key={z}
                    className={`${styles.chip} ${tag.zone === z ? styles.chipOn : ""}`}
                    onClick={() => set({ zone: z })}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>
                Level
                {lib.defaultLevel && !tag.level && <span className={styles.labelNote}> · defaults to Roof</span>}
              </span>
              <div className={styles.row}>
                {LEVELS.map(([v, text]) => (
                  <button
                    key={v}
                    className={`${styles.chip} ${tag.level === v ? styles.chipOn : ""}`}
                    onClick={() => set({ level: tag.level === v ? "" : v })}
                  >
                    {text}
                  </button>
                ))}
                <input
                  className={styles.numInput}
                  inputMode="numeric"
                  placeholder="Lvl"
                  value={/^L\d+$/.test(tag.level) && !LEVELS.some(([v]) => v === tag.level) ? tag.level.slice(1) : ""}
                  onChange={(e) => {
                    const n = e.target.value.replace(/\D/g, "");
                    set({ level: n ? "L" + n : "" });
                  }}
                />
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>
                Unit <span className={styles.labelNote}>· optional</span>
              </span>
              <input
                className={styles.numInput}
                inputMode="numeric"
                placeholder="e.g. 401"
                value={tag.unit}
                onChange={(e) => set({ unit: e.target.value.replace(/\D/g, "") })}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Codes</span>
              {codeGroups.map(({ band, codes }) => (
                <div key={band} className={styles.codeRow}>
                  {codes.map((c) => {
                    const on = tag.codes.includes(c.code);
                    const b = BANDS[band];
                    return (
                      <button
                        key={c.code}
                        className={`${styles.code} ${on ? styles.codeOn : ""}`}
                        style={on ? { background: b.bg, color: b.fg, boxShadow: `0 0 0 1.5px ${b.fg}` } : undefined}
                        title={c.what}
                        onClick={() => toggle(c.code)}
                      >
                        <b>{c.code}</b> {c.name}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className={styles.codeRow}>
                {systemCodes.map((c) => (
                  <button
                    key={c.code}
                    className={`${styles.code} ${tag.codes.includes(c.code) ? styles.codeOnPlain : ""}`}
                    onClick={() => toggle(c.code)}
                  >
                    <b>{c.code}</b> {c.code === "OV" ? "Overview" : "Other item of note"}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>
                Note <span className={styles.labelNote}>· optional, shown on the caption</span>
              </span>
              <input
                className={styles.textInput}
                placeholder="e.g. awning screws backing out"
                value={tag.note}
                onChange={(e) => set({ note: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
          </div>

          <div className={styles.foot}>
            <code className={`${styles.preview} ${valid ? "" : styles.previewBad}`}>
              {label || "—"}
              {!valid && result.kind === "rejected" && <span> · {result.reason}</span>}
            </code>
            {photos.length > 1 && (
              <button className={styles.secondary} onClick={next}>
                Skip
              </button>
            )}
            <button className={styles.primary} onClick={save} disabled={!valid}>
              {i < photos.length - 1 ? "Save & next" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
