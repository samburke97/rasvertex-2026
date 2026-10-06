"use client";
// components/reports/proposal/builder/BuildStep.tsx — Screen 2: Build.
// Section rail | live preview | editor for the selected section.

import { useState } from "react";
import styles from "./BuildStep.module.css";
import SectionRail from "./SectionRail";
import ProposalPreview from "./ProposalPreview";
import type { BuilderCtx } from "./context";
import CoverEditor from "./editors/CoverEditor";
import IntroEditor from "./editors/IntroEditor";
import ProjectEditor from "./editors/ProjectEditor";
import FindingsEditor from "./editors/FindingsEditor";
import ScopeEditor from "./editors/ScopeEditor";
import AccessPlanEditor from "./editors/AccessPlanEditor";
import PricingEditor from "./editors/PricingEditor";
import StandardTextEditor from "./editors/StandardTextEditor";
import ClientsEditor from "./editors/ClientsEditor";
import AcceptanceEditor from "./editors/AcceptanceEditor";
import ServicesEditor from "./editors/ServicesEditor";
import {
  SECTIONS,
  isSectionOn,
  sectionNumber,
  sectionStatus,
  type SectionId,
} from "@/lib/reports/proposal.types";

interface Props {
  ctx: BuilderCtx;
  sel: SectionId;
  scrollReq: { id: SectionId; n: number } | null;
}

function Editor({ ctx, sel }: { ctx: BuilderCtx; sel: SectionId }) {
  switch (sel) {
    case "cover":
      return <CoverEditor ctx={ctx} />;
    case "intro":
      return <IntroEditor ctx={ctx} />;
    case "project":
      return <ProjectEditor ctx={ctx} />;
    case "findings":
      return <FindingsEditor ctx={ctx} />;
    case "scope":
      return <ScopeEditor ctx={ctx} />;
    case "access":
      return <AccessPlanEditor ctx={ctx} />;
    case "pricing":
      return <PricingEditor ctx={ctx} />;
    case "warranty":
      return <StandardTextEditor ctx={ctx} field="warranty" />;
    case "why":
      return <ClientsEditor ctx={ctx} />;
    case "accept":
      return <AcceptanceEditor ctx={ctx} />;
    case "services":
      return <ServicesEditor ctx={ctx} />;
  }
}

export default function BuildStep({ ctx, sel, scrollReq }: Props) {
  const [railOpen, setRailOpen] = useState(true);
  const def = SECTIONS.find((s) => s.id === sel)!;
  const st = sectionStatus(ctx.p, sel);
  const meta =
    sel === "cover"
      ? "Cover page"
      : isSectionOn(ctx.p, sel)
        ? `Section ${sectionNumber(ctx.p, sel)}`
        : "Not included";

  return (
    <div className={styles.build}>
      <SectionRail ctx={ctx} sel={sel} open={railOpen} onToggleOpen={() => setRailOpen((o) => !o)} />
      <ProposalPreview ctx={ctx} sel={sel} scrollReq={scrollReq} />
      <aside className={styles.panel}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitles}>
            <span className={styles.panelNum}>{meta}</span>
            <span className={styles.panelName}>{def.name}</span>
          </div>
          <span className={styles.statusPill} style={{ color: st.color, background: st.bg }}>
            {st.text}
          </span>
        </div>
        <div className={styles.panelBody}>
          <Editor key={sel} ctx={ctx} sel={sel} />
        </div>
      </aside>
    </div>
  );
}
