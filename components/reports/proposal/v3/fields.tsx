"use client";
// Section panel field kinds: Text, Rich (the "/" editor), Select, Segmented,
// Photo, GroupHead, Note, InfoTip and collapsible list items. Each edits one
// path inside proposal.d and carries data-field={path} so a click on the
// page can bring it into view (SectionPanel).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Builder.module.css";
import type { BuilderCtx, Path } from "./ctx";
import DocEditor from "@/components/workspace/DocEditor";
import { richHtml } from "@/lib/reports/proposal/v3/rich";
import { money } from "@/lib/reports/proposal/v3/derive";

const str = (v: unknown) => (v == null ? "" : String(v));
const key = (path: Path) => path.join(".");

/** ⓘ with a hover / focus explanation. The bubble is portalled to the
 *  page body with fixed positioning, so no scrolling panel clips it; it sits
 *  above the icon, or below when there's no room, and stays on screen. */
export function InfoTip({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const W = 260;
    const x = Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2));
    const below = r.top < 140;
    setAt({ x, y: below ? r.bottom + 8 : r.top - 8, below });
  };
  return (
    <span
      ref={ref}
      className={styles.tip}
      tabIndex={0}
      aria-label="More information"
      onMouseEnter={show}
      onMouseLeave={() => setAt(null)}
      onFocus={show}
      onBlur={() => setAt(null)}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 11v5.5M12 7.6v.4" strokeLinecap="round" />
      </svg>
      {at &&
        createPortal(
          <span
            className={styles.tipBody}
            role="tooltip"
            style={{ left: at.x, top: at.y, transform: at.below ? "none" : "translateY(-100%)" }}
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}

function Label({ text, info }: { text: string; info?: ReactNode }) {
  return (
    <span className={styles.fieldLabel}>
      {text}
      {info && <InfoTip>{info}</InfoTip>}
    </span>
  );
}

export function Text({ ctx, label, path, ph, type = "text", info }: { ctx: BuilderCtx; label: string; path: Path; ph?: string; type?: string; info?: ReactNode }) {
  return (
    <label className={styles.field} data-field={key(path)}>
      <Label text={label} info={info} />
      <input className={styles.input} type={type} value={str(ctx.get(path))} placeholder={ph} onChange={(e) => ctx.set(path, e.target.value)} />
    </label>
  );
}

/** The "/" editor. prose: paragraphs and lists; list: one item per line. */
export function Rich({
  ctx,
  label,
  path,
  list,
  info,
  ph,
}: {
  ctx: BuilderCtx;
  label: string;
  path: Path;
  list?: boolean;
  info?: ReactNode;
  ph?: string;
}) {
  const raw = str(ctx.get(path));
  // Plain-text values from older drafts: one paragraph per line.
  const value = raw && !raw.trim().startsWith("<") ? richHtml(raw) : raw;
  return (
    <div className={styles.field} data-field={key(path)}>
      <Label
        text={label}
        info={
          info ?? (list ? "One item per line — press Enter for the next. Select text to make it bold or italic." : "Type “/” for a bullet or numbered list. Select text to make it bold or italic.")
        }
      />
      <div className={`${styles.rich} ${list ? styles.richList : ""}`}>
        <DocEditor
          variant={list ? "list" : "prose"}
          value={value}
          placeholder={ph ?? (list ? "One per line" : "Type, or “/” for a list")}
          onChange={(html) => ctx.set(path, html)}
        />
      </div>
    </div>
  );
}

/** An ex-GST amount: plain digits while typing, "$154,194.52" otherwise. */
export function Money({ ctx, label, path, info }: { ctx: BuilderCtx; label: string; path: Path; info?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const raw = str(ctx.get(path));
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  const shown = editing || !raw.trim() || isNaN(n) ? raw : money(n);
  return (
    <label className={styles.field} data-field={key(path)}>
      <Label text={label} info={info} />
      <input
        className={styles.input}
        inputMode="decimal"
        value={shown}
        placeholder="$0.00"
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => ctx.set(path, e.target.value.replace(/[^0-9.]/g, ""))}
      />
    </label>
  );
}

export function Select({
  ctx,
  label,
  path,
  options,
  onPick,
  info,
}: {
  ctx: BuilderCtx;
  label: string;
  path: Path;
  options: { v: string; label: string }[];
  onPick?: (v: string) => void;
  info?: ReactNode;
}) {
  return (
    <label className={styles.field} data-field={key(path)}>
      <Label text={label} info={info} />
      <select className={styles.select} value={str(ctx.get(path))} onChange={(e) => (onPick ? onPick(e.target.value) : ctx.set(path, e.target.value))}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Segmented({ label, options, value, onPick, info }: { label: string; options: { v: string; label: string }[]; value: string; onPick: (v: string) => void; info?: ReactNode }) {
  return (
    <div className={styles.field}>
      <Label text={label} info={info} />
      <div className={styles.seg}>
        {options.map((o) => (
          <button key={o.v} className={value === o.v ? styles.segOn : ""} onClick={() => onPick(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GroupHead({ title, sub, info }: { title: string; sub?: string; info?: ReactNode }) {
  return (
    <div className={styles.groupHead}>
      <b>
        {title}
        {info && <InfoTip>{info}</InfoTip>}
      </b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <span className={styles.note}>{children}</span>;
}

/** A list in p.d as one-line rows; a row opens to its fields when clicked
 *  here or on the page. "+ Add" until max. */
export function List<T>({
  ctx,
  path,
  max,
  blank,
  title,
  meta,
  render,
}: {
  ctx: BuilderCtx;
  path: Path;
  max: number;
  blank: () => T;
  title: (x: T, i: number) => string;
  /** Muted text on the right of the row, e.g. a price. */
  meta?: (x: T, i: number) => string;
  render: (i: number) => ReactNode;
}) {
  const arr = (ctx.get(path) as T[]) ?? [];
  const base = key(path) + ".";
  const [open, setOpen] = useState<number | null>(null);

  // A click on the page opens the matching row.
  const focus = ctx.focusField?.path;
  useEffect(() => {
    if (!focus?.startsWith(base)) return;
    const i = parseInt(focus.slice(base.length), 10);
    if (!isNaN(i)) setOpen(i);
  }, [focus, ctx.focusField?.n, base]);

  return (
    <>
      {arr.map((x, i) => (
        <div key={i} className={`${styles.item} ${open === i ? styles.itemOpen : ""}`} data-field={base + i}>
          <div className={styles.itemHead}>
            <button className={styles.itemToggle} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <svg className={styles.chev} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="m9 6 6 6-6 6" />
              </svg>
              <span className={styles.itemTitle}>{title(x, i) || `Item ${i + 1}`}</span>
              {meta && <span className={styles.itemMeta}>{meta(x, i)}</span>}
            </button>
            <button
              className={styles.remove}
              title="Remove"
              onClick={() => {
                ctx.set(path, arr.filter((_, j) => j !== i));
                setOpen(null);
              }}
            >
              ×
            </button>
          </div>
          {open === i && <div className={styles.itemBody}>{render(i)}</div>}
        </div>
      ))}
      {arr.length < max && (
        <button
          className={styles.add}
          onClick={() => {
            ctx.set(path, [...arr, blank()]);
            setOpen(arr.length);
          }}
        >
          + Add
        </button>
      )}
    </>
  );
}

/** Photo field: preview, Choose / Upload / Remove, and an inline picker.
 *  The picker always lists the quote's SimPRO folders (picking one that's
 *  off turns it on and loads it) next to the standard ones. */
export function Photo({ ctx, label, path, extra, info, large }: { ctx: BuilderCtx; label: string; path: Path; extra?: ReactNode; info?: ReactNode; large?: boolean }) {
  const k = key(path);
  const open = ctx.picker === k;
  const ref = str(ctx.get(path));
  const src = ctx.img(ref);
  const [busy, setBusy] = useState(false);

  const filters = [
    { id: "all", name: "All" },
    ...ctx.allFolders.map((f) => ({ id: f.id, name: f.name, off: !f.on, sp: f.sp })),
    ...(ctx.p.uploads.length ? [{ id: "uploads", name: "Uploads" }] : []),
  ];
  const active = filters.some((f) => f.id === ctx.pickFolder) ? ctx.pickFolder : "all";
  const pool =
    active === "all"
      ? [...ctx.p.uploads, ...ctx.folders.flatMap((f) => f.photos)]
      : active === "uploads"
        ? ctx.p.uploads
        : (ctx.folders.find((f) => f.id === active)?.photos ?? []);
  const loadingThis = ctx.loadingFolders.includes(active);

  return (
    <div className={styles.field} data-field={k}>
      <Label text={label} info={info} />
      {large && ref ? (
        <div className={styles.photoLarge} style={{ backgroundImage: src ? `url("${src}")` : "none" }} onClick={() => ctx.setPicker(open ? null : k)} />
      ) : null}
      <div className={styles.photoRow}>
        {!large && (
          <div className={styles.thumb} style={{ backgroundImage: src ? `url("${src}")` : "none" }} onClick={() => ctx.setPicker(open ? null : k)} />
        )}
        <button className={styles.smallBtn} onClick={() => ctx.setPicker(open ? null : k)}>
          {open ? "Close" : ref ? "Change" : "Choose"}
        </button>
        <label className={styles.smallBtn} style={{ cursor: busy ? "default" : "pointer" }}>
          {busy ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              try {
                const url = await ctx.upload(f);
                if (url) ctx.set(path, url);
                ctx.setPicker(null);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {extra}
        {ref && (
          <button className={`${styles.smallBtn} ${styles.danger}`} title="Remove this photo from the page" onClick={() => ctx.set(path, "")}>
            Remove
          </button>
        )}
      </div>
      {open && (
        <div className={styles.picker}>
          <div className={styles.pickerHead}>
            <span>Photos</span>
            <button className={styles.linkBtn} disabled={ctx.reloading} onClick={() => ctx.reloadSimpro()} title="Fetch the quote's photo folders again">
              {ctx.reloading ? "Reloading…" : "↻ Reload from SimPRO"}
            </button>
            <InfoTip>
              Photos come from the quote’s folders in SimPRO. Added photos in SimPRO? Reload. A folder that’s greyed out is off. Click it to load its photos.
            </InfoTip>
          </div>
          <div className={styles.chips}>
            {filters.map((f) => (
              <button
                key={f.id}
                className={`${styles.filter} ${active === f.id ? styles.filterOn : ""} ${"off" in f && f.off ? styles.filterOff : ""}`}
                title={"off" in f && f.off ? "Off for this proposal. Click to load its photos" : undefined}
                onClick={() => {
                  if ("off" in f && f.off) ctx.enableFolder(f.id);
                  ctx.setPickFolder(f.id);
                }}
              >
                {"sp" in f && f.sp && <span className={styles.spDot} />}
                {f.name}
              </button>
            ))}
          </div>
          {pool.length ? (
            <div className={styles.grid}>
              {pool.map((x) => (
                <div
                  key={x}
                  className={`${styles.cell} ${x === ref ? styles.cellOn : ""}`}
                  style={{ backgroundImage: `url("${ctx.img(x)}")` }}
                  onClick={() => {
                    ctx.set(path, x);
                    ctx.setPicker(null);
                  }}
                >
                  {ctx.p.uploads.includes(x) && (
                    <button
                      className={styles.cellRemove}
                      title="Delete this upload"
                      onClick={(e) => {
                        e.stopPropagation();
                        ctx.removeUpload(x);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className={styles.empty}>{loadingThis ? "Loading photos from SimPRO…" : "No photos here. Pick another folder, reload from SimPRO, or upload one."}</span>
          )}
        </div>
      )}
    </div>
  );
}
