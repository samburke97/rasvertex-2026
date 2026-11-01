"use client";
// The right-hand panel in Build: the selected page's fields (README §7).
// Locked pages show their lock note instead. Clicking text or a photo on the
// page brings its field here into view and puts the cursor in it.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import MapCaptureModal from "@/components/reports/inspection/MapCaptureModal";
import styles from "./Builder.module.css";
import type { BuilderCtx } from "./ctx";
import { GroupHead, InfoTip, List, Money, Note, Photo, Rich, Segmented, Select, Text } from "./fields";
import { CARD_W, FINDING_PHOTO_H, REPORT_PHOTO_H } from "@/lib/reports/proposal/v3/layout";
import { methodHtml } from "@/lib/reports/proposal/v3/methods";
import { isHidden, money, parseAmt } from "@/lib/reports/proposal/v3/derive";
import { applySurvey, enabledPhotos, findingFor, recodeFromTags, standardFromPhotos, taggedPhotos } from "@/lib/reports/proposal/v3/survey";
import {
  BRANDS,
  CODES,
  JOB_FIELDS,
  LIMITS,
  LOCK_NOTES,
  PAGE,
  TRADES,
  BANDS,
  codeRank,
  codesOf,
  withCodes,
  type Brand,
  type FindingsStyle,
  type PhotoPos,
  type PageId,
  type Proposal,
  type SpecRow,
} from "@/lib/reports/proposal/v3/types";

const CODE_LIST = Object.keys(CODES).map((k) => ({ v: k, label: `${k} · ${CODES[k].name}` }));
const CODE_OPTS = CODE_LIST;
const pad = (n: number) => String(n).padStart(2, "0");

/** Dulux ↔ Haymes: swap brand, and its name in the spec wording and intro. */
function setBrand(p: Proposal, b: Brand): Proposal {
  const from = BRANDS[p.d.project.brand].name;
  const to = BRANDS[b].name;
  if (from === to) return p;
  const sw = (s: string) => s.split(from).join(to);
  return {
    ...p,
    d: {
      ...p.d,
      intro: JSON.parse(sw(JSON.stringify(p.d.intro))),
      project: { ...p.d.project, brand: b, specIntro: sw(p.d.project.specIntro), note: sw(p.d.project.note) },
    },
  };
}

/** Report style brings in the Flagged issues and Pre-start pages; standard
 *  style leaves them out. */
function setFindingsStyle(p: Proposal, style: FindingsStyle): Proposal {
  const report = style === "report";
  if (report && p.d.findings.style !== "report") p = recodeFromTags(p);
  return {
    ...p,
    hidden: { ...p.hidden, flagged: !report, prestart: !report },
    d: { ...p.d, findings: { ...p.d.findings, style } },
  };
}

const bgOf = (url: string): CSSProperties => ({ backgroundImage: url ? `url("${url}")` : "none" });

/** A finding's codes as toggle chips: tap to add or remove. The most
 *  severe one decides which group the photo sits in. */
function CodePicker({ ctx, index }: { ctx: BuilderCtx; index: number }) {
  const f = ctx.p.d.findings.items[index];
  const on = codesOf(f);
  const toggle = (c: string) =>
    ctx.set(["findings", "items", index], withCodes(f, on.includes(c) ? on.filter((x) => x !== c) : [...on, c]));
  return (
    <div className={styles.field} data-field={`findings.items.${index}.codes`}>
      <span className={styles.fieldLabel}>
        Codes
        <InfoTip>
          Tap every defect in this photo. It shows once, under its most severe code; the other codes’ groups point to it. Codes also fill Flagged issues and Pre-start. No code puts it in “Other site photos”.
        </InfoTip>
      </span>
      <div className={styles.codeGrid}>
        {CODE_LIST.map(({ v, label }) => {
          const b = BANDS[CODES[v].band];
          const sel = on.includes(v);
          return (
            <button
              key={v}
              className={`${styles.codeChip} ${sel ? styles.codeChipOn : ""}`}
              style={sel ? { background: b.bg, color: b.fg, borderColor: "transparent" } : undefined}
              title={label}
              onClick={() => toggle(v)}
            >
              {v}
            </button>
          );
        })}
      </div>
      <span className={styles.note}>{on.length ? on.map((c) => CODES[c].name).join(" · ") : "No code: shown under Other site photos"}</span>
    </div>
  );
}

/** Report style's site map: so the client can find D10 on the building. */
function SiteMapField({ ctx }: { ctx: BuilderCtx }) {
  const [mapOpen, setMapOpen] = useState(false);
  const d = ctx.p.d;
  const own = !!d.findings.map;
  const on = d.findings.showMap !== false;
  const toggle = (
    <div className={styles.switchRow}>
      <span className={styles.fieldLabel}>
        Site map
        <InfoTip>Optional. A map of the building with a pin for each section (S1, D10…) in the photos’ names, so the client can find them.</InfoTip>
      </span>
      <button
        className={`${styles.switch} ${on ? styles.switchOn : ""}`}
        role="switch"
        aria-checked={on}
        title={on ? "Hide the site map" : "Show a site map"}
        onClick={() => ctx.set(["findings", "showMap"], !on)}
      />
    </div>
  );
  if (!on) return toggle;
  return (
    <>
      {toggle}
      <Photo
        ctx={ctx}
        label="Map image"
        path={["findings", "map"]}
        info="Shown above the findings with a pin for every zone in the photos’ locations. Drag the pins on the page to place them. Until you choose one, it uses the access plan’s aerial."
        extra={
          ctx.p.job.site ? (
            <button className={styles.smallBtn} onClick={() => setMapOpen(true)}>
              Satellite
            </button>
          ) : null
        }
      />
      {!own && <Note>{d.access.aerial ? "Using the access plan’s aerial photo." : "No map yet: choose a photo or capture one from satellite."}</Note>}
      {mapOpen && (
        <MapCaptureModal
          address={ctx.p.job.site}
          size={{ w: 640, h: 320 }}
          initial={d.findings.mapView ?? d.access.aerialView}
          onCancel={() => setMapOpen(false)}
          onCapture={async (dataUrl, view) => {
            const url = await ctx.uploadData(dataUrl, "site-map");
            ctx.update((prev) => ({ ...prev, d: { ...prev.d, findings: { ...prev.d.findings, map: url, mapView: view } } }));
            setMapOpen(false);
          }}
        />
      )}
    </>
  );
}

/** "How we fix it" for each code in use: collapsible rows with the steps as
 *  a list. Starts from the standard steps; "Use standard" resets. */
function MethodRows({ ctx }: { ctx: BuilderCtx }) {
  const codes = [...new Set(ctx.p.d.findings.items.flatMap(codesOf))].sort((a, b) => codeRank(a) - codeRank(b));
  const [open, setOpen] = useState<string | null>(null);
  const focus = ctx.focusField?.path;
  useEffect(() => {
    const m = focus?.match(/^findings\.methods\.(\w+)/);
    if (m) setOpen(m[1]);
  }, [focus, ctx.focusField?.n]);
  if (!codes.length) return null;
  return (
    <>
      <GroupHead
        title="How we fix it"
        info="The steps printed once under each code’s group. They start from our standard method. Changes apply to this proposal only."
      />
      {codes.map((c) => {
        const own = ctx.p.d.findings.methods?.[c];
        return (
          <div key={c} className={`${styles.item} ${open === c ? styles.itemOpen : ""}`}>
            <div className={styles.itemHead}>
              <button className={styles.itemToggle} onClick={() => setOpen(open === c ? null : c)} aria-expanded={open === c}>
                <svg className={styles.chev} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="m9 6 6 6-6 6" />
                </svg>
                <span className={styles.itemTitle}>
                  {c} · {CODES[c].name}
                </span>
                <span className={styles.itemMeta}>{own ? "Edited" : "Standard"}</span>
              </button>
            </div>
            {open === c && (
              <div className={styles.itemBody}>
                <Rich ctx={ctx} label="Steps" path={["findings", "methods", c]} list fallback={methodHtml(c)} />
                {own && (
                  <button className={styles.linkBtn} style={{ justifySelf: "start" }} onClick={() => ctx.set(["findings", "methods", c], undefined)}>
                    Use standard steps
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Findings run to dozens of photos. With none picked, the panel shows the
 *  grid and the quote's unused photos (to bring back). Picking one — here or
 *  by clicking it on the page — shows only that finding. */
function FindingsPanel({ ctx }: { ctx: BuilderCtx }) {
  const d = ctx.p.d;
  const items = d.findings.items;
  const report = d.findings.style === "report";
  const f = ctx.focusFinding != null && ctx.focusFinding < items.length ? ctx.focusFinding : null;
  const path = (k: string) => ["findings", "items", f!, k];
  const blank = (photo = "") => ({ photo, code: "", title: "", desc: "" });
  const [adjusting, setAdjusting] = useState(false);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    ctx.set(["findings", "items"], next);
  };

  if (f != null) {
    const it = items[f];
    const move = (by: number) => {
      const j = f + by;
      if (j < 0 || j >= items.length) return;
      const next = [...items];
      [next[f], next[j]] = [next[j], next[f]];
      ctx.set(["findings", "items"], next);
      ctx.pickFinding(j, true);
    };
    return (
      <>
        <div className={styles.focusBar}>
          <button className={styles.linkBtn} onClick={() => ctx.pickFinding(null, false)}>
            ‹ Back to Site survey &amp; findings
          </button>
          <span className={styles.focusCount}>
            {f + 1} of {items.length}
          </span>
          <span className={styles.focusNav}>
            <button className={styles.remove} title="Previous photo" disabled={f === 0} onClick={() => ctx.pickFinding(f - 1, true)}>
              ↑
            </button>
            <button className={styles.remove} title="Next photo" disabled={f === items.length - 1} onClick={() => ctx.pickFinding(f + 1, true)}>
              ↓
            </button>
          </span>
        </div>
        <Photo
          ctx={ctx}
          label="Photo"
          path={path("photo")}
          extra={
            it.photo && (
              <button className={styles.smallBtn} onClick={() => setAdjusting(true)} title="Drag to move the photo in its frame; zoom in to crop">
                Adjust
              </button>
            )
          }
        />
        {adjusting && it.photo && (
          <CropModal
            src={ctx.img(it.photo)}
            aspect={CARD_W / (report ? REPORT_PHOTO_H : FINDING_PHOTO_H)}
            pos={it.pos}
            onDone={(pos) => {
              ctx.set(path("pos"), pos);
              setAdjusting(false);
            }}
            onClose={() => setAdjusting(false)}
          />
        )}
        {report && (
          <CodePicker ctx={ctx} index={f} />
        )}
        {report && (
          <Text
            ctx={ctx}
            label="Location"
            path={path("where")}
            ph="e.g. D10 L2 U403"
            info="Zone (S# section or D# drop), level (LG, L2, LR) and unit. Photos are grouped by section on the page, so only level and unit print on the photo. The zone is pinned on the site map and listed in Flagged issues."
          />
        )}
        <Text ctx={ctx} label="Title" path={path("title")} ph="e.g. Render crack, north face level 2" />
        {report ? (
          <Rich ctx={ctx} label="Description" path={path("desc")} ph="Optional: anything the client should know about this photo" />
        ) : (
          <Rich ctx={ctx} label="Points" path={path("desc")} list info="One point per line, up to five. Only the first five show on the page." />
        )}
        <div className={styles.itemActions}>
          <button className={styles.smallBtn} disabled={f === 0} onClick={() => move(-1)}>
            Move earlier
          </button>
          <button className={styles.smallBtn} disabled={f === items.length - 1} onClick={() => move(1)}>
            Move later
          </button>
          <button
            className={`${styles.smallBtn} ${styles.danger}`}
            onClick={() => {
              ctx.set(["findings", "items"], items.filter((_, j) => j !== f));
              ctx.pickFinding(null, false);
            }}
            title={it.photo.startsWith("ph:") ? "Takes it off the page. It stays in SimPRO, and you can bring it back below the photo grid." : "Takes it off the page."}
          >
            Remove from page
          </button>
        </div>
      </>
    );
  }

  // Photos from the switched-on SimPRO folders that aren't on the page.
  const used = new Set(items.map((x) => x.photo));
  const unused = enabledPhotos(ctx.p).filter((ph) => !used.has("ph:" + ph.id));
  const tagged = report ? taggedPhotos(ctx.p) : [];
  const spFolders = ctx.allFolders.filter((x) => x.sp);

  return (
    <>
      <Segmented
        label="Style"
        value={d.findings.style}
        options={[
          { v: "standard", label: "Standard" },
          { v: "report", label: "Report style" },
        ]}
        onPick={(v) => ctx.update((prev) => setFindingsStyle(prev, v as FindingsStyle))}
        info={
          <>
            <b>Standard:</b> a photo, a title and up to five points.
            <br />
            <b>Report style:</b> a defect code on each photo, plus the Flagged issues and Pre-start pages. It reads tags in the SimPRO file name, like “D1 L2 U403 SH - comment”.
          </>
        }
      />
      {report && <SiteMapField ctx={ctx} />}
      <Rich ctx={ctx} label="Intro" path={["findings", "intro"]} />

      {report && <MethodRows ctx={ctx} />}
      <GroupHead
        title={`On the page · ${items.length}`}
        sub="Click a photo to edit it, or drag to reorder. Pages are added as needed."
      />
      {items.length > 0 ? (
        <div className={styles.fgrid}>
          {items.map((it, i) => (
            <button
              key={i}
              className={`${styles.fcell} ${drag?.from === i ? styles.fcellDragging : ""} ${drag && drag.over === i && drag.from !== i ? (drag.from < i ? styles.fcellDropAfter : styles.fcellDropBefore) : ""}`}
              style={bgOf(ctx.img(it.photo))}
              title={it.title || `Finding ${pad(i + 1)}`}
              onClick={() => ctx.pickFinding(i, true)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                setDrag({ from: i, over: i });
              }}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                if (drag.over !== i) setDrag({ ...drag, over: i });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) reorder(drag.from, i);
                setDrag(null);
              }}
              onDragEnd={() => setDrag(null)}
            >
              <span className={styles.fnum}>{i + 1}</span>
            </button>
          ))}
          {items.length < LIMITS.findings && (
            <button
              className={`${styles.fcell} ${styles.fadd}`}
              title="Add a finding with its own photo"
              onClick={() => {
                ctx.set(["findings", "items"], [...items, blank()]);
                ctx.pickFinding(items.length, true);
              }}
            >
              +
            </button>
          )}
        </div>
      ) : (
        <Note>No photos on this page yet. Bring some in from SimPRO below.</Note>
      )}

      <GroupHead
        title={`From SimPRO · ${unused.length} not used`}
        info="Photos in the quote’s SimPRO folders that aren’t on this page. Click one to add it, or bring them all in. Removing a photo from the page never deletes it from SimPRO."
      />
      <div className={styles.chips}>
        {spFolders.map((x) => (
          <button
            key={x.id}
            className={`${styles.filter} ${x.on ? styles.filterOn : styles.filterOff}`}
            title={x.on ? "Click to stop using this folder" : "Click to load this folder’s photos"}
            onClick={() => ctx.enableFolder(x.id, !x.on)}
          >
            <span className={styles.spDot} />
            {x.name}
            <span className={styles.chipCount}>{x.count}</span>
          </button>
        ))}
        <button className={styles.linkBtn} disabled={ctx.reloading} onClick={() => ctx.reloadSimpro()}>
          {ctx.reloading ? "Reloading…" : "↻ Reload"}
        </button>
      </div>
      {ctx.loadingFolders.length > 0 && <Note>Loading photos from SimPRO…</Note>}
      {unused.length > 0 && (
        <>
          <div className={styles.fgrid}>
            {unused.slice(0, 40).map((ph) => (
              <button
                key={ph.id}
                className={`${styles.fcell} ${styles.fcellAdd}`}
                style={bgOf(ph.url)}
                title={`Add “${ph.name}”`}
                onClick={() => {
                  ctx.set(["findings", "items"], [...items, findingFor(ph)]);
                  ctx.pickFinding(items.length, true);
                }}
              >
                <span className={styles.fplus}>+</span>
              </button>
            ))}
          </div>
          <div className={styles.itemActions}>
            <button
              className={styles.smallBtn}
              onClick={() =>
                ctx.set(
                  ["findings", "items"],
                  [...items, ...unused.slice(0, LIMITS.findings - items.length).map(findingFor)],
                )
              }
            >
              Add all {Math.min(unused.length, LIMITS.findings - items.length)}
            </button>
            {report
              ? tagged.length > 0 && (
                  <button className={styles.smallBtn} onClick={() => ctx.update((prev) => applySurvey(prev))}>
                    Rebuild from {tagged.length} tagged
                  </button>
                )
              : items.length > 0 && (
                  <button
                    className={styles.smallBtn}
                    title="Replaces what’s on the page with every photo from the switched-on folders"
                    onClick={async () => {
                      const ok = await ctx.confirm({
                        title: "Start the findings again?",
                        body: "Every finding is replaced with the SimPRO photos. Titles and points you've written are lost.",
                        ok: "Replace findings",
                        danger: true,
                      });
                      if (ok) ctx.update(standardFromPhotos);
                    }}
                  >
                    Start again
                  </button>
                )}
          </div>
        </>
      )}
    </>
  );
}

function Fields({ ctx, id }: { ctx: BuilderCtx; id: PageId }) {
  const d = ctx.p.d;
  const [mapOpen, setMapOpen] = useState(false);
  switch (id) {
    case "cover":
      return (
        <>
          <Rich ctx={ctx} label="Summary under the title" path={["cover", "blurb"]} />
          <Photo ctx={ctx} label="Cover photo" path={["cover", "photo"]} />
          <GroupHead
            title="Job details"
            sub="Highlighted on the page. Change them here and every page updates."
            info="These came from the SimPRO quote. Reload the quote in step 1 to pull them again."
          />
          {JOB_FIELDS.map((f) => (
            <label key={f.key} className={styles.field} data-field={`job.${f.key}`}>
              <span className={styles.fieldLabel}>{f.label}</span>
              <input
                className={styles.input}
                type={f.type}
                value={ctx.p.job[f.key] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  ctx.update((prev) => ({ ...prev, job: { ...prev.job, [f.key]: v } }));
                }}
              />
            </label>
          ))}
        </>
      );
    case "intro":
      return (
        <>
          <Rich ctx={ctx} label="Opening paragraph" path={["intro", "open"]} />
          <GroupHead title="Key points" />
          <List
            ctx={ctx}
            path={["intro", "bullets"]}
            max={LIMITS.bullets}
            blank={() => ({ t: "", d: "" })}
            title={(_, i) => `Point ${i + 1}`}
            render={(i) => (
              <>
                <Text ctx={ctx} label="Point" path={["intro", "bullets", i, "t"]} />
                <Rich ctx={ctx} label="Detail" path={["intro", "bullets", i, "d"]} />
              </>
            )}
          />
          <Rich ctx={ctx} label="Closing paragraph" path={["intro", "close"]} />
        </>
      );
    case "project": {
      const b = d.project.brand;
      return (
        <>
          <Rich ctx={ctx} label="Overview" path={["project", "p1"]} />
          <Rich ctx={ctx} label="Access and site" path={["project", "p2"]} />
          <Text ctx={ctx} label="Building type" path={["project", "type"]} />
          <Text ctx={ctx} label="Access method" path={["project", "access"]} />
          <Text
            ctx={ctx}
            label="Program · required"
            path={["project", "program"]}
            ph="e.g. 9 weeks"
            info="How long the works take on site. Required: the proposal can’t be saved or downloaded until it’s filled in."
          />
          <Photo ctx={ctx} label="Project photo" path={["project", "photo"]} />
          <GroupHead title={TRADES[ctx.p.trade].specTitle} sub="Choose the product. The table, logo and wording switch with it." />
          <Segmented
            label="Product"
            value={b}
            options={TRADES[ctx.p.trade].brands.map((k) => ({ v: k, label: BRANDS[k].name }))}
            onPick={(v) => ctx.update((prev) => setBrand(prev, v as Brand))}
            info="Each product keeps its own table. Switching also swaps the brand name in the wording and the introduction."
          />
          <Rich ctx={ctx} label="Specification intro" path={["project", "specIntro"]} />
          <List<SpecRow>
            ctx={ctx}
            path={["project", "rows", b]}
            max={LIMITS.specRows}
            blank={() => ({ surface: "", system: "", coats: "2 full coats" })}
            title={(_, i) => `Row ${i + 1}`}
            meta={(x) => x.surface}
            render={(i) => (
              <>
                <Text ctx={ctx} label="Surface" path={["project", "rows", b, i, "surface"]} />
                <Text ctx={ctx} label="System" path={["project", "rows", b, i, "system"]} />
                <Text ctx={ctx} label={TRADES[ctx.p.trade].coatsLabel} path={["project", "rows", b, i, "coats"]} />
              </>
            )}
          />
          <Text ctx={ctx} label="Note beside the logo" path={["project", "note"]} />
        </>
      );
    }
    case "scope":
      return (
        <>
          <Rich ctx={ctx} label="Intro" path={["scope", "intro"]} />
          <Rich ctx={ctx} label="Included" path={["scope", "inc"]} list info="One item per line. A long list carries on to the next page by itself." />
          <Rich ctx={ctx} label="Not included" path={["scope", "exc"]} list info="One item per line. A long list carries on to the next page by itself." />
        </>
      );
    case "findings":
      return <FindingsPanel ctx={ctx} />;
    case "flagged":
      return (
        <>
          <Rich ctx={ctx} label="Intro" path={["flagged", "intro"]} />
          <Note>Rows come from the codes on your survey photos and update by themselves. Edit a row and it stays as you set it.</Note>
          <List<{ code: string; count: string }>
            ctx={ctx}
            path={["flagged", "rows"]}
            max={LIMITS.flagged}
            blank={() => ({ code: "RC", count: "1" })}
            title={(x) => `${x.code} · ${CODES[x.code]?.name ?? ""}`}
            meta={(x) => `${x.count || 0} found`}
            render={(i) => (
              <>
                <Select ctx={ctx} label="Defect" path={["flagged", "rows", i, "code"]} options={CODE_OPTS} />
                <Text ctx={ctx} label="Where" path={["flagged", "rows", i, "where"]} ph="e.g. D10, D12, S1" />
                <Text ctx={ctx} label="Locations found" path={["flagged", "rows", i, "count"]} type="number" />
              </>
            )}
          />
        </>
      );
    case "prestart":
      return (
        <>
          <Rich ctx={ctx} label="Intro" path={["prestart", "intro"]} />
          <Note>Rows come from the codes on your survey photos and update by themselves. Edit a row and it stays as you set it.</Note>
          <List<{ code: string; work: string; where: string }>
            ctx={ctx}
            path={["prestart", "rows"]}
            max={LIMITS.prestart}
            blank={() => ({ code: "RC", work: CODES.RC.defaultWork, where: "" })}
            title={(x) => `${x.code} · ${CODES[x.code]?.name ?? ""}`}
            meta={(x) => x.where}
            render={(i) => (
              <>
                <Select
                  ctx={ctx}
                  label="Code"
                  path={["prestart", "rows", i, "code"]}
                  options={CODE_OPTS}
                  onPick={(v) => ctx.set(["prestart", "rows", i], { ...d.prestart.rows[i], code: v, work: CODES[v]?.defaultWork ?? "" })}
                  info="Changing the code also resets the work wording to that code’s standard."
                />
                <Text ctx={ctx} label="Work" path={["prestart", "rows", i, "work"]} />
                <Text ctx={ctx} label="Where" path={["prestart", "rows", i, "where"]} ph="e.g. D10 L2, S3 L4" />
              </>
            )}
          />
          <Rich ctx={ctx} label="Please note" path={["prestart", "note"]} />
        </>
      );
    case "access": {
      const stageOpts = d.access.stages.map((x, i) => ({ v: String(i), label: x.what || `Stage ${i + 1}` }));
      return (
        <>
          <Rich ctx={ctx} label="Intro" path={["access", "intro"]} />
          <Photo
            ctx={ctx}
            label="Aerial or elevation photo"
            path={["access", "aerial"]}
            info="Required before export. “Satellite” opens Google Maps at the site address: pan and zoom until the building fills the frame, then use that view."
            extra={
              ctx.p.job.site ? (
                <button className={styles.smallBtn} onClick={() => setMapOpen(true)}>
                  Satellite
                </button>
              ) : null
            }
          />
          {mapOpen && (
            <MapCaptureModal
              address={ctx.p.job.site}
              size={{ w: 640, h: 320 }}
              initial={d.access.aerialView}
              onCancel={() => setMapOpen(false)}
              onCapture={async (dataUrl, view) => {
                await ctx.saveAerial(dataUrl, view);
                setMapOpen(false);
              }}
            />
          )}
          <GroupHead title="Programme" info="Up to four stages. Each drop below is coloured by the stage it belongs to." />
          <List
            ctx={ctx}
            path={["access", "stages"]}
            max={LIMITS.stages}
            blank={() => ({ when: "Weeks", what: "", where: "" })}
            title={(_, i) => `Stage ${i + 1}`}
            meta={(x) => x.what}
            render={(i) => (
              <>
                <Text ctx={ctx} label="When" path={["access", "stages", i, "when"]} />
                <Text ctx={ctx} label="Stage" path={["access", "stages", i, "what"]} />
                <Text ctx={ctx} label="Drops" path={["access", "stages", i, "where"]} />
              </>
            )}
          />
          <GroupHead title="Drops" />
          <List<{ d: string; where: string }>
            ctx={ctx}
            path={["access", "drops"]}
            max={LIMITS.drops}
            blank={() => ({ d: `D${d.access.drops.length + 1}`, where: "", access: "Rope access", levels: "", stage: "0" })}
            title={(x, i) => x.d || `Drop ${i + 1}`}
            meta={(x) => x.where}
            render={(i) => (
              <>
                <Text ctx={ctx} label="Drop" path={["access", "drops", i, "d"]} />
                <Text ctx={ctx} label="Where" path={["access", "drops", i, "where"]} />
                <Text ctx={ctx} label="Access" path={["access", "drops", i, "access"]} />
                <Text ctx={ctx} label="Levels" path={["access", "drops", i, "levels"]} />
                <Select ctx={ctx} label="Stage" path={["access", "drops", i, "stage"]} options={stageOpts} />
              </>
            )}
          />
        </>
      );
    }
    case "pricing":
      return (
        <>
          <Rich ctx={ctx} label="Intro" path={["pricing", "intro"]} />
          <GroupHead
            title="Price stages"
            sub="Totals, GST and the cover price update automatically."
            info="Filled from the SimPRO quote’s cost centres when the proposal was first made. Edit them here. Amounts are ex GST."
          />
          <List<{ label: string; amt: string }>
            ctx={ctx}
            path={["pricing", "stages"]}
            max={LIMITS.priceStages}
            blank={() => ({ label: "", note: "", amt: "0" })}
            title={(_, i) => `Stage ${i + 1}`}
            meta={(x) => money(parseAmt(x.amt))}
            render={(i) => (
              <>
                <Text ctx={ctx} label="Stage" path={["pricing", "stages", i, "label"]} />
                <Text ctx={ctx} label="When" path={["pricing", "stages", i, "note"]} />
                <Money ctx={ctx} label="Price ex GST" path={["pricing", "stages", i, "amt"]} />
              </>
            )}
          />
          <Rich ctx={ctx} label="Payment terms" path={["pricing", "terms"]} list />
        </>
      );
    case "maintenance":
      return (
        <>
          <Rich ctx={ctx} label="Intro" path={["maintenance", "intro"]} />
          <Money ctx={ctx} label="Plan price per year, ex GST" path={["maintenance", "price"]} info="GST and the incl. GST line work themselves out. Leave it blank to show $0, or hide the page." />
        </>
      );
    case "accept":
      return (
        <>
          <Rich ctx={ctx} label="Intro" path={["accept", "intro"]} />
          <Note>The validity date and the RAS-VERTEX signatory come from the job details on the cover.</Note>
        </>
      );
    default:
      return null;
  }
}

export default function SectionPanel({ ctx, width }: { ctx: BuilderCtx; width: number }) {
  const id = ctx.sel;
  const pg = PAGE[id];
  const hidden = isHidden(ctx.p, id);
  const body = useRef<HTMLDivElement | null>(null);
  const n = ctx.D.sheetCount[id] ?? 1;
  const kicker =
    id === "cover"
      ? "Cover page"
      : id === "contents"
        ? "Contents"
        : hidden
          ? "Hidden page"
          : n > 1
            ? `Pages ${ctx.D.pageNo[id]}–${pad(Number(ctx.D.pageNo[id]) + n - 1)} of ${ctx.D.pageTotal}`
            : `Page ${ctx.D.pageNo[id]} of ${ctx.D.pageTotal}`;
  const off = !!ctx.p.hidden[id];

  // A click on the page: snap the field into view, focus it, and open the
  // picker if it's a photo.
  const focus = ctx.focusField;
  useEffect(() => {
    if (!focus) return;
    const t = requestAnimationFrame(() => {
      const root = body.current;
      if (!root) return;
      // A finding's photo clicked on the page: the text is what gets edited
      // most, so land in its title (Change is right above it).
      const target = focus.path.replace(/^(findings\.items\.\d+)\.photo$/, "$1.title");
      let el: HTMLElement | null = null;
      for (let p = target; p && !el; p = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "")
        el = root.querySelector<HTMLElement>(`[data-field="${p}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      const input = el.querySelector<HTMLElement>("input:not([type=file]), select, .tiptap");
      if (input) input.focus({ preventScroll: true });
      else if (/photo|aerial$/.test(target)) ctx.setPicker(el.dataset.field ?? null);
    });
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n]);

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.panelHead}>
        <div className={styles.panelHeadText}>
          <span className={styles.kicker}>{kicker}</span>
          <span className={styles.panelTitle}>{pg.name}</span>
        </div>
        {id !== "cover" && (
          <button
            className={`${styles.switch} ${off ? "" : styles.switchOn}`}
            role="switch"
            aria-checked={!off}
            title={off ? "Include this page" : "Hide this page"}
            onClick={() => ctx.toggleHide(id)}
          />
        )}
      </div>
      <div className={styles.panelBody} key={id} ref={body}>
        {pg.locked ? (
          <div className={styles.lockNote}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>{LOCK_NOTES[id]}</span>
          </div>
        ) : (
          <>
            {id !== "findings" && <Note>Tip: click any text or photo on the page to jump to it here.</Note>}
            <Fields ctx={ctx} id={id} />
          </>
        )}
      </div>
    </aside>
  );
}


/** Frame a photo: drag to move it, slide to zoom. The frame has the card's
 *  proportions and is rendered the way the page renders it (focal point +
 *  scale), so what's framed here is what prints. */
function CropModal({ src, aspect, pos, onDone, onClose }: { src: string; aspect: number; pos?: PhotoPos; onDone: (pos: PhotoPos | undefined) => void; onClose: () => void }) {
  const [p, setP] = useState<PhotoPos>(pos ?? { x: 50, y: 50, zoom: 1 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const im = new Image();
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = src;
  }, [src]);

  // How far the photo overflows the frame at this zoom, in frame pixels,
  // so a drag moves the photo with the pointer.
  const overflow = () => {
    const el = frame.current;
    if (!el || !nat) return { w: 0, h: 0, fw: 1, fh: 1 };
    const fw = el.clientWidth;
    const fh = el.clientHeight;
    const s = Math.max(fw / nat.w, fh / nat.h);
    return { w: nat.w * s - fw, h: nat.h * s - fh, fw, fh };
  };
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, x: p.x, y: p.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const s0 = start.current;
    if (!s0) return;
    const o = overflow();
    const dx = e.clientX - s0.px;
    const dy = e.clientY - s0.py;
    // Distance (frame px) the focal point travels from 0 to 100 %: the
    // cover overflow, scaled by zoom, plus what the zoom itself pushes out.
    // Moving the photo right reveals its left, so the focal point falls.
    const z = p.zoom;
    const rx = o.fw * (z - 1) + o.w * z;
    const ry = o.fh * (z - 1) + o.h * z;
    setP((q) => ({
      ...q,
      x: rx > 0.5 ? clamp(s0.x - (dx / rx) * 100) : q.x,
      y: ry > 0.5 ? clamp(s0.y - (dy / ry) * 100) : q.y,
    }));
  };
  const onUp = () => (start.current = null);

  return createPortal(
    <div className={`${styles.vars} ${styles.modalBack}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${styles.cropModal}`} role="dialog" aria-label="Adjust photo">
        <div className={styles.modalHead}>
          <div>
            <b>Adjust photo</b>
            <small>Drag to move it in the frame. Zoom in to crop tighter.</small>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div
          ref={frame}
          className={styles.cropFrame}
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => setP((q) => ({ ...q, zoom: Math.max(1, Math.min(3, q.zoom - e.deltaY * 0.002)) }))}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("${src}")`,
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: `${p.x}% ${p.y}%`,
              transform: p.zoom > 1 ? `scale(${p.zoom})` : undefined,
              transformOrigin: `${p.x}% ${p.y}%`,
              pointerEvents: "none",
            }}
          />
        </div>
        <div className={styles.cropBar}>
          <span>Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={p.zoom} onChange={(e) => setP({ ...p, zoom: Number(e.target.value) })} />
          <button className={styles.linkBtn} onClick={() => setP({ x: 50, y: 50, zoom: 1 })}>
            Reset
          </button>
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostPill} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.darkPill}
            onClick={() => onDone(p.x === 50 && p.y === 50 && p.zoom === 1 ? undefined : { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, zoom: Math.round(p.zoom * 100) / 100 })}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
