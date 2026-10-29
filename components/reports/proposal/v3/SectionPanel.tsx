"use client";
// The right-hand panel in Build: the selected page's fields (README §7).
// Locked pages show their lock note instead. Clicking text or a photo on the
// page brings its field here into view and puts the cursor in it.

import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./Builder.module.css";
import type { BuilderCtx } from "./ctx";
import { GroupHead, List, Money, Note, Photo, Rich, Segmented, Select, Text } from "./fields";
import { isHidden, money, parseAmt } from "@/lib/reports/proposal/v3/derive";
import { applySurvey, enabledPhotos, recodeFromTags, standardFromPhotos, taggedPhotos } from "@/lib/reports/proposal/v3/survey";
import {
  BRANDS,
  CODES,
  JOB_FIELDS,
  LIMITS,
  LOCK_NOTES,
  PAGE,
  TRADES,
  type Brand,
  type FindingsStyle,
  type PageId,
  type Proposal,
  type SpecRow,
} from "@/lib/reports/proposal/v3/types";

const CODE_LIST = Object.keys(CODES).map((k) => ({ v: k, label: `${k} · ${CODES[k].name}` }));
// Findings can have no code; Flagged / Pre-start rows always have one.
const FINDING_CODES = [{ v: "", label: "No code" }, ...CODE_LIST];
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
            ‹ All photos
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
        <Photo ctx={ctx} label={`Finding ${pad(f + 1)}`} path={path("photo")} large />
        {report && (
          <Select
            ctx={ctx}
            label="Code"
            path={path("code")}
            options={FINDING_CODES}
            info="Sets the chip and severity colour, and adds the defect to Flagged issues and Pre-start. “No code” leaves this photo out of both."
          />
        )}
        <Text ctx={ctx} label="Title" path={path("title")} ph="e.g. Render crack, north face level 2" />
        {report ? (
          <Rich ctx={ctx} label="What we do about it" path={path("desc")} />
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
      <Rich ctx={ctx} label="Intro" path={["findings", "intro"]} />

      <GroupHead
        title={`On the page · ${items.length}`}
        sub="Click a photo to edit it. Four photos to a page; pages are added as needed."
      />
      {items.length > 0 ? (
        <div className={styles.fgrid}>
          {items.map((it, i) => (
            <button key={i} className={styles.fcell} style={bgOf(ctx.img(it.photo))} title={it.title || `Finding ${pad(i + 1)}`} onClick={() => ctx.pickFinding(i, true)}>
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
                  ctx.set(["findings", "items"], [...items, blank("ph:" + ph.id)]);
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
                  [...items, ...unused.slice(0, LIMITS.findings - items.length).map((ph) => blank("ph:" + ph.id))],
                )
              }
            >
              Add all {Math.min(unused.length, LIMITS.findings - items.length)}
            </button>
            {report
              ? tagged.length > 0 && (
                  <button className={styles.smallBtn} onClick={() => ctx.update((prev) => applySurvey(prev, tagged))}>
                    Rebuild from {tagged.length} tagged
                  </button>
                )
              : items.length > 0 && (
                  <button
                    className={styles.smallBtn}
                    title="Replaces what’s on the page with every photo from the switched-on folders"
                    onClick={() => {
                      if (confirm("Replace every finding with the SimPRO photos? Titles and points you've written will be lost.")) ctx.update(standardFromPhotos);
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
          <Text ctx={ctx} label="Program" path={["project", "program"]} ph="e.g. 9 weeks" />
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
            info="Required before export. “Satellite” captures the site address from Google Maps; Remove takes it off the page."
            extra={
              ctx.p.job.site ? (
                <button className={styles.smallBtn} onClick={() => ctx.captureAerial()}>
                  Satellite
                </button>
              ) : null
            }
          />
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
      let el: HTMLElement | null = null;
      for (let p = focus.path; p && !el; p = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "")
        el = root.querySelector<HTMLElement>(`[data-field="${p}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      const input = el.querySelector<HTMLElement>("input:not([type=file]), select, .tiptap");
      if (input) input.focus({ preventScroll: true });
      else if (/photo|aerial$/.test(focus.path)) ctx.setPicker(el.dataset.field ?? null);
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

