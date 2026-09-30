// lib/reports/hours.react-pdf.tsx
//
// PILOT — not wired into any route yet. This is a trial rewrite of
// hours.print.ts using @react-pdf/renderer instead of Puppeteer/Chromium,
// to evaluate whether its Yoga-based layout engine (real flexbox, true
// page-wrapping, no browser) is a better fit than the HTML+Chromium
// pipeline the rest of lib/reports/*.print.ts uses.
//
// Key difference from hours.print.ts: no ROWS_PER_FIRST_PAGE /
// ROWS_PER_CONTINUATION constants. The row list is a single flex column
// inside one <Page wrap>; react-pdf measures it and splits across as many
// physical pages as needed on its own — confirmed working, 45 synthetic
// rows correctly split into a 25/20 two-page layout with no manual math.
//
// That auto-pagination is the one part of this pilot that worked cleanly.
// Everything else needed for a repeating per-page header/footer surfaced a
// real engine bug — see FINDING #1/#2/#3 below. None of these are pagination
// design flaws; they're @react-pdf/renderer + fontkit reliability gaps hit
// while building a genuinely small, ~150-line report.

import { Document, Page, View, Text, Image, Font, StyleSheet } from "@react-pdf/renderer";
import type { HoursBreakdownData } from "./hours.types";
import type { ScheduleRow } from "./condition.types";
import { formatScheduleDate } from "./condition.types";
import { BRAND_NAVY, type ReportAssets } from "./print-shared";

// Font registration happens lazily in ensureFonts() once we have the real
// font src (a data: URI from ReportAssets) — there's no valid src to
// register at module-load time.
//
// FINDING #1: public/fonts/inter.woff2 is a variable font (has fvar/gvar/
// avar tables). react-pdf's font embedder (fontkit) crashes subsetting it —
// "RangeError: Offset is outside the bounds of the DataView" in fontkit's
// glyf encoder — regardless of how many weights are registered against it.
// Chromium embeds this exact file without issue; fontkit does not.
// Confirmed fix: pre-instance each weight actually used into a static
// (non-variable) font with fontTools (`instantiateVariableFont`) at build
// time and register *those* instead of the variable file directly.
//
// FINDING #2 (unresolved): even swapped for a static instance, adding
// public/fonts/bebas-neue.woff2 as a second registered family reliably
// crashes the SAME fontkit encoder, but only once the document spans more
// than one physical page — a single-page render with both fonts registered
// succeeds; a multi-page render with the exact same two fonts does not.
// Bebas Neue alone (no Inter) and Inter alone (no Bebas Neue) both embed
// fine at any page count, so the trigger is specifically "two custom font
// families + more than one page." Toggling how the page-1-only banner is
// expressed (a page-number-aware `render` callback vs. a plain always-on
// `fixed` View) flips which cases crash, which points to a real ordering/
// state bug in fontkit's subsetter rather than anything wrong with either
// font file. This is why the title/heading below render in Inter rather
// than Bebas Neue for now — reverting that is blocked on either a fontkit
// fix/upgrade or isolating a reliable workaround, neither done here.
let fontsRegistered = false;
function ensureFonts(a: ReportAssets) {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.register({
    family: "Inter",
    fonts: [
      { src: a.interFont, fontWeight: 300 },
      { src: a.interFont, fontWeight: 400 },
      { src: a.interFont, fontWeight: 600 },
      { src: a.interFont, fontWeight: 700 },
    ],
  });
}

// ── Layout constants (pt, 72dpi — react-pdf's native unit) ───────────────────
// Reserved page paddingTop must be constant across every generated page
// since `fixed` elements are positioned relative to the page, not appended
// after whatever came before — so the tallest possible header (page 1's
// title+link+heading band, plus the table column header) sets the budget
// every page pays, even continuation pages whose own banner is shorter.
const PAGE_PAD_X = 33; // 2.75rem
const BANNER_H = 56; // title + link-logo row
const HEADING_H = 26; // job info subheading row
const TABLE_HEADER_H = 22;
const HEADER_TOTAL_H = BANNER_H + HEADING_H + TABLE_HEADER_H;
const FOOTER_H = 54;
const A4_HEIGHT_PT = 841.89;

const styles = StyleSheet.create({
  // Page keeps its top/bottom padding — that's what makes react-pdf reserve
  // this much space on *every* generated page, not just the first. Margin
  // on flowWrap was tried instead (avoids the coordinate-space issue below)
  // but only ever applies once, at the very top/bottom of all the content,
  // not per page — a multi-page render showed rows overlapping the footer
  // by the second page. Page padding is the only mechanism that reserves
  // space per page here.
  //
  // The trade-off: `position: absolute` (every fixed band below) is
  // positioned relative to the PADDING box of its nearest positioned
  // ancestor — standard CSS behaviour, react-pdf included — so `top: 0`
  // on a fixed child lands at the padding box's top edge, i.e. exactly
  // where flow content also starts, not at the physical page edge. Each
  // fixed band below compensates with a *negative* top/bottom equal to
  // how far above/below the padding box its band needs to sit.
  page: {
    fontFamily: "Inter",
    fontSize: 9.5,
    color: "#333",
    paddingTop: HEADER_TOTAL_H,
    paddingBottom: FOOTER_H,
  },
  flowWrap: {
    paddingLeft: PAGE_PAD_X,
    paddingRight: PAGE_PAD_X,
  },
  bannerBand: {
    position: "absolute",
    top: -HEADER_TOTAL_H,
    left: PAGE_PAD_X,
    right: PAGE_PAD_X,
    height: BANNER_H,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: "Inter",
    fontSize: 27,
    letterSpacing: 1.5,
    color: BRAND_NAVY,
  },
  topbarLink: { height: 12, marginTop: 4 },
  continuationLabel: {
    fontFamily: "Inter",
    fontSize: 12,
    letterSpacing: 1,
    color: "#9ca3af",
  },
  headingBand: {
    position: "absolute",
    top: -(HEADING_H + TABLE_HEADER_H),
    left: PAGE_PAD_X,
    right: PAGE_PAD_X,
    height: HEADING_H,
    justifyContent: "center",
  },
  headingTitle: {
    fontFamily: "Inter",
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: BRAND_NAVY,
  },
  tableHeaderBand: {
    position: "absolute",
    top: -TABLE_HEADER_H,
    left: PAGE_PAD_X,
    right: PAGE_PAD_X,
    height: TABLE_HEADER_H,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 6.5,
  },
  th: {
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#374151",
  },
  colDate: { width: "40%" },
  colEmployee: { width: "42%" },
  colHours: { width: "18%", textAlign: "right" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6.5,
    paddingVertical: 4.3,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  td: { fontSize: 9, fontWeight: 300, color: "#333" },
  totalsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6.5,
    paddingVertical: 5,
    borderTopWidth: 1.5,
    borderTopColor: BRAND_NAVY,
  },
  totalsLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: BRAND_NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  totalsCell: {
    fontSize: 9,
    fontWeight: 600,
    color: BRAND_NAVY,
    textAlign: "right",
  },
  footerBand: {
    position: "absolute",
    // FINDING #3 (unresolved): <Image> children never render inside a
    // `fixed` element in this document — not here, not in bannerBand's
    // link-logo image either. The surrounding View's own border/background
    // paints fine either way; only the <Image> is silently dropped. Neither
    // offset sign (this started as `bottom: -FOOTER_H`, the mirror of how
    // the header bands reach up into their reserved space) nor the
    // `fixed`+`render` wrapper (used successfully to fix FINDING #-adjacent
    // Text rendering above) changes it. `top` computed from the A4 page
    // height is kept here as the more defensible of two equally-broken
    // options, not because it fixed anything. Net effect: this pilot cannot
    // currently reproduce the per-page association-logo footer at all.
    top: A4_HEIGHT_PT - HEADER_TOTAL_H - FOOTER_H,
    left: PAGE_PAD_X,
    right: PAGE_PAD_X,
    height: FOOTER_H,
    borderTopWidth: 1,
    borderTopColor: "#ebebeb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  footerLogo: { height: 20, objectFit: "contain" },
});

function buildHeading(report: HoursBreakdownData): string {
  const parts: string[] = [];
  if (report.job.jobNo) parts.push(report.job.jobNo);
  if (report.job.customerName) parts.push(report.job.customerName);
  if (
    report.settings.filterByDate &&
    (report.settings.dateFrom || report.settings.dateTo)
  ) {
    const from = report.settings.dateFrom ?? "";
    const to = report.settings.dateTo ?? "";
    if (from && to) parts.push(`${from} – ${to}`);
    else if (from) parts.push(`From ${from}`);
    else parts.push(`To ${to}`);
  } else {
    parts.push("All Dates");
  }
  return parts.join("  |  ");
}

export function HoursDocument({
  report,
  assets,
}: {
  report: HoursBreakdownData;
  assets: ReportAssets;
}) {
  ensureFonts(assets);
  const rows: ScheduleRow[] = report.schedule;
  const totalHours = rows.reduce((s, r) => s + r.actualHours, 0);
  const heading = buildHeading(report);
  const logos = [
    assets.associations.communitySelect,
    assets.associations.dulux,
    assets.associations.haymes,
    assets.associations.mpa,
    assets.associations.qbcc,
    assets.associations.smartStrata,
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View
          fixed
          render={({ pageNumber }) =>
            pageNumber === 1 ? (
              <View style={styles.bannerBand}>
                <Text style={styles.title}>SCHEDULE</Text>
                <Image src={assets.linkBlue} style={styles.topbarLink} />
              </View>
            ) : (
              <View style={[styles.bannerBand, { alignItems: "center" }]}>
                <Text style={styles.continuationLabel}>SCHEDULE (CONTINUED)</Text>
              </View>
            )
          }
        />
        <View
          fixed
          render={({ pageNumber }) =>
            pageNumber === 1 ? (
              <View style={styles.headingBand}>
                <Text style={styles.headingTitle}>{heading}</Text>
              </View>
            ) : null
          }
        />
        <View
          fixed
          render={() => (
            <View style={styles.tableHeaderBand}>
              <Text style={[styles.th, styles.colDate]}>Date</Text>
              <Text style={[styles.th, styles.colEmployee]}>Employee</Text>
              <Text style={[styles.th, styles.colHours]}>Hours</Text>
            </View>
          )}
        />

        <View style={styles.flowWrap}>
          {rows.map((row) => (
            <View key={row.id} style={styles.row} wrap={false}>
              <Text style={[styles.td, styles.colDate]}>
                {formatScheduleDate(row.date)}
              </Text>
              <Text style={[styles.td, styles.colEmployee]}>{row.employeeName}</Text>
              <Text style={[styles.td, styles.colHours]}>
                {row.actualHours > 0 ? row.actualHours.toFixed(2) : "—"}
              </Text>
            </View>
          ))}

          {rows.length > 0 && (
            <View style={styles.totalsRow} wrap={false}>
              <Text style={[styles.totalsLabel, styles.colDate]}>Total</Text>
              <Text style={styles.colEmployee} />
              <Text style={[styles.totalsCell, styles.colHours]}>
                {totalHours > 0 ? totalHours.toFixed(2) : "—"}
              </Text>
            </View>
          )}
        </View>

        <View
          fixed
          render={() => (
            <View style={styles.footerBand}>
              {logos.map((src, i) => (
                <Image key={i} src={src} style={styles.footerLogo} />
              ))}
            </View>
          )}
        />
      </Page>
    </Document>
  );
}
