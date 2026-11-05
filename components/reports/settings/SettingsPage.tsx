// components/reports/settings/SettingsPage.tsx
//
// Reports › Settings. The section menu (portalled into the layout, as
// Caro's is) and one screen per hash route.

"use client";

import { useEffect, useState } from "react";
import { setTopNav } from "@/components/layouts/topNavSlot";
import "./settings.css";
import { leaves } from "@/lib/reports/settings/library";
import AnchorTypesScreen from "./AnchorTypesScreen";
import CodesScreen from "./CodesScreen";
import ReportTypesScreen from "./ReportTypesScreen";
import SeverityScreen from "./SeverityScreen";
import TagsScreen from "./TagsScreen";
import { useSettings, type SaveState } from "./store";
import { Ic, P } from "./ui";

export type View = "new" | "types" | "codes" | "tags" | "severity" | "anchors";
export const SETTINGS_VIEWS: View[] = ["types", "codes", "tags", "severity", "anchors"];

/** "#types/roof/tiled" → { view: "types", path: ["roof", "tiled"] } */
export function readHash(hash: string): { view: View; path: string[] } {
  const [v, ...path] = hash.replace(/^#/, "").split("/").map(decodeURIComponent);
  return { view: (SETTINGS_VIEWS as string[]).includes(v) ? (v as View) : "new", path };
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => readHash(typeof window === "undefined" ? "" : window.location.hash));
  useEffect(() => {
    const on = () => setRoute(readHash(window.location.hash));
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function ReportsMenu({ view }: { view: View }) {
  const { s } = useSettings();
  const cur = (v: View) => (view === v ? ({ "aria-current": "page" } as const) : {});
  const nCodes = s.codes.filter((c) => !c.archived).length;
  return (
    <div className="rs rs-menu">
      <div className="subnav__title">Reports</div>
      <nav className="subnav__body" aria-label="Reports">
        <a className="subnav__item" href="#new" {...cur("new")}>
          <Ic d={P.report} />
          <span className="subnav__text">New report</span>
        </a>
        <div className="subnav__divider" />
        <a className="subnav__item" href="#types" {...cur("types")}>
          <Ic d={P.types} />
          <span className="subnav__text">Report types</span>
          <span className="badge">{leaves(s).length}</span>
        </a>
        <div className="subnav__divider" />
        <div className="subnav__label">Photo tags</div>
        <a className="subnav__item" href="#codes" {...cur("codes")}>
          <Ic d={P.code} />
          <span className="subnav__text">Defect codes</span>
          <span className="badge">{nCodes}</span>
        </a>
        <a className="subnav__item" href="#tags" {...cur("tags")}>
          <Ic d={P.pin} />
          <span className="subnav__text">Location tags</span>
          <span className="badge">{s.tags.length}</span>
        </a>
        <div className="subnav__divider" />
        <div className="subnav__label">Setup</div>
        <a className="subnav__item" href="#severity" {...cur("severity")}>
          <Ic d={P.bars} />
          <span className="subnav__text">Severity</span>
        </a>
        <a className="subnav__item" href="#anchors" {...cur("anchors")}>
          <Ic d={P.anchor} />
          <span className="subnav__text">Anchor types</span>
          <span className="badge">{s.anchors.length}</span>
        </a>
      </nav>
    </div>
  );
}

const CRUMB: Record<View, string> = {
  new: "New report",
  types: "Report types",
  codes: "Defect codes",
  tags: "Location tags",
  severity: "Severity",
  anchors: "Anchor types",
};

function SaveStatus({ save, unlock }: { save: SaveState; unlock: (code: string) => void }) {
  const [code, setCode] = useState("");
  if (save.phase === "locked")
    return (
      <form
        className="lock"
        onSubmit={(e) => {
          e.preventDefault();
          unlock(code);
        }}
      >
        <span className="save save--err">
          <Ic d={P.lock} size={14} /> Admin passcode to save
        </span>
        <input className="search" type="password" aria-label="Passcode" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        <button className="btn btn--sm btn--primary">Save</button>
      </form>
    );
  const cls = save.phase === "error" ? " save--err" : save.phase === "saving" || save.phase === "loading" ? " save--busy" : "";
  const text =
    save.phase === "error" ? save.message : save.phase === "saving" ? "Saving…" : save.phase === "loading" ? "Loading…" : "All changes saved";
  return (
    <span className={`save${cls}`}>
      <span className="save__dot" />
      {text}
    </span>
  );
}

export default function SettingsPage({ view, path }: { view: View; path: string[] }) {
  const { s, save, unlock, loaded } = useSettings();
  // Where you are and whether it's saved go in the app's top bar.
  const crumbs = [{ label: CRUMB[view], href: `#${view}` }];
  if (view === "types" && path[0]) {
    const r = s.reports.find((x) => x.key === path[0]);
    const t = r?.types.find((x) => x.key === path[1]);
    if (r) crumbs.push({ label: r.name, href: `#types/${r.key}` });
    if (t) crumbs.push({ label: t.name, href: `#types/${r!.key}/${t.key}` });
  }
  const crumbKey = JSON.stringify(crumbs);
  useEffect(() => {
    setTopNav({
      crumbs: JSON.parse(crumbKey),
      status: (
        <div className="rs">
          <SaveStatus save={save} unlock={unlock} />
        </div>
      ),
    });
  }, [crumbKey, save, unlock]);
  useEffect(() => () => setTopNav({}), []);

  return (
    <div className="rs rs-root">
      {save.phase === "error" && save.problems && save.problems.length > 1 && (
        <div className="page" style={{ paddingBottom: 0 }}>
          <div className="problems">
            {save.problems.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </div>
      )}
      {!loaded ? null : view === "codes" ? (
        <CodesScreen />
      ) : view === "tags" ? (
        <TagsScreen />
      ) : view === "severity" ? (
        <SeverityScreen />
      ) : view === "anchors" ? (
        <AnchorTypesScreen />
      ) : (
        <ReportTypesScreen path={path} />
      )}
    </div>
  );
}
