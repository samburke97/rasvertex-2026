// lib/checkin/config.ts
//
// Every threshold, rule and email line for Client Check-in (/checkin) lives
// here. Changes apply on the next "Refresh from SimPRO" (or the daily cron).
//
// Text templates use {placeholders}. Available in angle text:
//   {first} {site} {job} {month} {date} {ago} {months} {value}
//   {due} {dueWord} {dueWordShort} {dueSentence} {cycle} {visits}
//   {quote} {quoteNo} {quoteValue} {quoteDate} {quoteMonth} {days} {more}
//   {count} {service} {missing} {owing}
// Email templates (greeting/intro/outro) take {first} and {site}.

export const CHECKIN_CONFIG = {
  // Leave null to use today's date (Australia/Brisbane).
  today: null as string | null,

  // ── SimPRO data fixes ─────────────────────────────────────────────────
  // ServiceM8 jobs were bulk-archived into SimPRO on this date, so their
  // CompletedDate is meaningless — the job's DateIssued is used instead.
  serviceM8BulkArchiveDate: "2025-01-03",
  // Of those, only jobs at these statuses were finished in ServiceM8
  // (Job: Fully-paid / Fully Invoiced / Part Payment Received). The other
  // ~2,150 sit at "Job to Schedule" and look like a mix of lost ServiceM8
  // quotes and unfinished work (avg painting value $38k vs $12k for paid
  // ones). They're shown in history as "unconfirmed" but don't count toward
  // lifetime value or trigger follow-ups. Set to true to count them anyway.
  countUnconfirmedServiceM8Jobs: false,
  serviceM8CompletedStatusIds: [14, 13, 85],
  excludeCustomerIds: [523], // "Test Customer"
  excludeJobIds: [10864], // "Final Test" ($708,750)
  // Job statuses that aren't real work: Cancelled / Duplicate / Archive,
  // Quote: Archived - Not Won, Job: Internals.
  excludeJobStatusIds: [84, 68, 96],
  // Jobs in these stages count as work in progress, not history.
  activeJobStages: ["Pending", "Progress"],

  // ── Quotes ────────────────────────────────────────────────────────────
  quotes: {
    // Sent / Due Date Reached / On Hold: a decision is owed to us.
    chaseStatusIds: [112, 4, 101],
    // Initial Visit / To Be Scheduled / Visit Scheduled / To Write: we owe
    // them a quote. Counted as "open" and blocks pitching the same service.
    inProgressStatusIds: [104, 3, 66, 100],
    chaseAfterDays: 30,
    // Quotes older than this are "stale" — still listed, weaker angle.
    freshForDays: 180,
    // Quotes older than this are ignored entirely.
    maxAgeDays: 730,
  },

  // ── Invoices ──────────────────────────────────────────────────────────
  invoices: {
    // Only flag "chase payment first" when an invoice is past its due date
    // and more than this much is still owing (AUD ex GST).
    minOwingExTax: 50,
    onlyOverdue: true,
  },

  // ── Services ──────────────────────────────────────────────────────────
  // A job counts as a service when it's in one of the cost centres, or its
  // name / first line of description contains one of the keywords.
  // Cost centre IDs from SimPRO setup/accounts/costCenters (Oct 2026).
  services: {
    painting: {
      label: "Painting",
      costCentreIds: [6, 12, 19, 22], // Painting Comm/Resi, Repaint, Building Repaint
      keywords: ["repaint", "painting", "paint "],
    },
    wash: {
      label: "Building wash",
      costCentreIds: [13, 8, 14], // Pressure Cleaning, Bluewater PC, Surface Cleaning
      keywords: ["building wash", "washdown", "wash down", "pressure clean", "soft wash", "building clean", "surface clean"],
    },
    windows: {
      label: "Window cleaning",
      costCentreIds: [16, 4], // Window Cleaning, Bluewater WC
      keywords: ["window clean", "windows clean", "glass clean"],
    },
    anchors: {
      label: "Height safety / anchors",
      costCentreIds: [11],
      keywords: ["anchor", "height safety", "recertification", "static line", "fall arrest"],
    },
    waterproofing: {
      label: "Waterproofing",
      costCentreIds: [15],
      keywords: ["waterproof", "membrane"],
    },
    ropeAccess: {
      label: "Rope access",
      costCentreIds: [], // no cost centre — keyword only
      keywords: ["rope access", "abseil"],
    },
    maintenance: {
      label: "Building maintenance",
      costCentreIds: [2],
      keywords: [],
    },
  },

  // ── Angles (recommended follow-ups) ───────────────────────────────────
  // weight 0–100 ranks angles for a client; the top one drives the email.
  // An angle for a service is skipped when that service already has a job
  // in progress or an open quote.
  angles: {
    chasePayment: {
      enabled: true,
      blocker: true,
      weight: 100,
      label: "Chase payment first",
      title: "Do NOT send sales email — {count} overdue invoice(s), {owing} owing",
      reason: "Overdue invoices: {owing} ex GST. Chase payment before any sales contact.",
    },
    doNotContact: {
      enabled: true,
      blocker: true,
      weight: 100,
      label: "Do not contact",
      title: "Do not contact (BLACKLIST tag / do-not-call)",
      reason: "Client is tagged BLACKLIST or marked do-not-call in SimPRO.",
    },
    anchorsDue: {
      enabled: true,
      weight: 95,
      monthsAfter: 12,
      leadDays: 60, // start flagging this long before it's due
      maxMonthsOverdue: 36,
      label: "Anchor recert due",
      title: "Anchor recertification {dueWord} {due}",
      reason: "Last height safety job was {job} on {date} ({ago} ago). Anchors need testing and recertifying every 12 months.",
      subject: "{site}: anchor recertification {dueWordShort}",
      para: "Our records show the height safety anchors at {site} were last done in {month}, so the annual test and recertification {dueSentence}. Keeping them in date keeps your contractors and insurer happy. Would you like us to book it in?",
    },
    quoteChase: {
      enabled: true,
      weight: 90,
      staleWeight: 60,
      label: "Chase open quote",
      title: "Chase quote #{quoteNo}: {quote} ({quoteValue}, {days} days old){more}",
      reason: "Quote #{quoteNo} {quote} for {quoteValue} was sent {quoteDate} and hasn't been decided.",
      subject: "{site}: following up on our quote",
      para: "I wanted to follow up on the quote we sent through in {quoteMonth} ({quote}, {quoteValue} + GST). If it's still on the cards, we'd be glad to lock in dates now so it's sorted early in the new year. Happy to answer any questions or adjust the scope.",
    },
    paintWash: {
      enabled: true,
      weight: 85,
      minPaintValueExTax: 1000,
      minMonths: 10,
      maxMonths: 84, // ~7 years, a typical paint system warranty
      label: "Repaint → building wash",
      title: "Repainted {month} — building wash to protect the paint warranty",
      reason: "{job} finished {date} ({ago} ago, {value}) and no building wash since. Paint warranties generally require regular washing.",
      subject: "{site}: looking after the paintwork",
      para: "It's been {ago} since we finished the painting at {site} in {month}. A gentle building wash removes the dirt, salt and mould that break paint down early, and most paint manufacturers ask for regular washing to keep their coating warranties valid. Would you like a quote for a wash?",
    },
    bigJobWalkthrough: {
      enabled: true,
      weight: 80,
      minValueExTax: 50000,
      minMonths: 9,
      maxMonths: 36,
      label: "Warranty walk-through",
      title: "Warranty walk-through on {job} ({value}, {month})",
      reason: "Large job ({value}) finished {date}, {ago} ago. Offer a free walk-through to check how it's holding up.",
      subject: "{site}: a quick walk-through of our work",
      para: "It's been {ago} since we wrapped up {job} at {site}. We'd like to offer a quick, no-cost walk-through to check how everything is holding up and fix anything that needs attention under warranty.",
    },
    washDue: {
      enabled: true,
      weight: 75,
      defaultCycleMonths: 12,
      minCycleMonths: 6,
      maxCycleMonths: 24,
      overdueFactor: 1.1, // flag once it's 10% past the usual cycle
      maxMonths: 48,
      label: "Building wash due",
      title: "Building wash overdue — last {month}, usually {cycle}",
      reason: "{visits} wash(es) on record, usually {cycle}. Last was {job} on {date} ({ago} ago).",
      subject: "{site}: time for a building wash?",
      para: "Our last building wash at {site} was in {month}, {ago} ago. A regular wash keeps the building looking sharp and stops grime and mould setting into the paint and render. Would you like us to book the next one in?",
    },
    waterproofCheck: {
      enabled: true,
      weight: 70,
      minMonths: 10,
      maxMonths: 24,
      label: "Waterproofing 12-month check",
      title: "12-month waterproofing check on {job} ({month})",
      reason: "Waterproofing ({job}) finished {date}, {ago} ago. Offer a 12-month inspection.",
      subject: "{site}: 12-month waterproofing check",
      para: "It's been {ago} since we completed the waterproofing at {site} in {month}, so it's a good time for a quick inspection of the membrane, joints, sealants and outlets. Small things are cheap to fix now and expensive once water gets through.",
    },
    windowsDue: {
      enabled: true,
      weight: 70,
      defaultCycleMonths: 6,
      minCycleMonths: 1,
      maxCycleMonths: 12,
      overdueFactor: 1.1,
      maxMonths: 36,
      label: "Window clean due",
      title: "Window clean overdue — last {month}, usually {cycle}",
      reason: "{visits} window clean(s) on record, usually {cycle}. Last was {date} ({ago} ago).",
      subject: "{site}: window clean before Christmas?",
      para: "Our last window clean at {site} was in {month}. With the holidays coming up, would you like the glass done so the building looks its best over summer? We can fit it in before the break.",
    },
    paintCheckin: {
      enabled: true,
      weight: 60,
      minMonths: 10,
      maxMonths: 24,
      label: "12-month painting check-in",
      title: "12-month check-in on {job} ({month})",
      reason: "Painting job {job} finished {date}, {ago} ago.",
      subject: "{site}: checking in on the painting",
      para: "It's been {ago} since we finished {job} at {site}, and I wanted to check everything is holding up well. If there are any touch-ups or areas you'd like us to look at, we're happy to come by.",
    },
    ropeAccessCheckin: {
      enabled: true,
      weight: 55,
      minMonths: 10,
      maxMonths: 24,
      label: "Rope access check-in",
      title: "Check-in on rope access work {job} ({month})",
      reason: "Rope access job {job} finished {date}, {ago} ago.",
      subject: "{site}: anything up high we can help with?",
      para: "We were last up on ropes at {site} in {month} for {job}. If there's anything else at height that needs attention (sealant, facade repairs, signage, gutters), it's often cheaper to bundle it into one visit.",
    },
    maintenanceDue: {
      enabled: true,
      weight: 45,
      minVisits: 2,
      defaultCycleMonths: 12,
      minCycleMonths: 3,
      maxCycleMonths: 24,
      overdueFactor: 1.1,
      maxMonths: 36,
      label: "Maintenance check-in",
      title: "Maintenance client — last visit {month}, usually {cycle}",
      reason: "{visits} maintenance jobs on record, usually {cycle}. Last was {job} on {date}.",
      subject: "{site}: anything on the maintenance list?",
      para: "It's been {ago} since our last maintenance visit at {site} ({job}). Is there anything on the list we can knock over before Christmas or early in the new year?",
    },
    lapsed: {
      enabled: true,
      weight: 40,
      minMonths: 24,
      label: "Lapsed client",
      title: "Lapsed client — no work since {month}",
      reason: "No jobs in {ago}. Last was {job} on {date}.",
      subject: "Checking in from RAS-VERTEX",
      para: "It's been a while since we last worked together at {site} ({job}, {month}). We've grown our team across painting, height safety, rope access, waterproofing and building cleaning, so I wanted to reintroduce ourselves in case anything is on the list for next year.",
    },
    crossSell: {
      enabled: true,
      weight: 35,
      activeWithinMonths: 36,
      label: "Cross-sell",
      title: "Uses {service}, never had {missing}",
      reason: "{service} client (last {month}) with no {missing} on record.",
      subject: "{site}: one more thing we can help with",
      // Checked in order; the first one that fits is used.
      rules: [
        { has: "windows" as ServiceKey, missing: "anchors" as ServiceKey, para: "As we already look after the windows at {site}, we can also test and certify the roof anchors your window cleaners rely on. It's a legal requirement every 12 months and we can line it up with the next clean." },
        { has: "anchors" as ServiceKey, missing: "windows" as ServiceKey, para: "As we already look after the height safety anchors at {site}, our rope access team can also do the window cleaning from the same anchors, usually for less than a swing stage or EWP." },
        { has: "anchors" as ServiceKey, missing: "wash" as ServiceKey, para: "As we already look after the anchors at {site}, our rope access team can also give the building a full external wash from the same system. Happy to quote." },
        { has: "wash" as ServiceKey, missing: "windows" as ServiceKey, para: "As we already wash the building at {site}, we can do the windows on the same visit, which saves a second mobilisation." },
        { has: "painting" as ServiceKey, missing: "anchors" as ServiceKey, para: "If the roof anchors at {site} haven't been tested in the last 12 months, our height safety team can test and certify them. It's a yearly requirement for anyone working on the roof." },
      ],
    },
    quotedNeverWon: {
      enabled: true,
      weight: 30,
      withinMonths: 36,
      label: "Quoted, never won",
      title: "Quoted {count} time(s), never went ahead — last {quote} ({quoteMonth})",
      reason: "No completed jobs. Last quote: {quote} for {quoteValue} on {quoteDate}.",
      subject: "{site}: checking in",
      para: "We quoted on {quote} at {site} back in {quoteMonth}. If that work, or anything else, is still on the list, I'd love the chance to help next year.",
    },
    // Only used when nothing more specific applies.
    general: {
      enabled: true,
      weight: 10,
      label: "General check-in",
      title: "General pre-Christmas check-in",
      reason: "No specific trigger. A friendly check-in.",
      subject: "Pre-Christmas check-in from RAS-VERTEX",
      para: "I'm getting in touch with everyone we've worked with to see if there's anything we can help with before Christmas or early in the new year.",
    },
  },

  // ── Priority score (0–100) ────────────────────────────────────────────
  // Points per factor; they add up to 100.
  score: {
    lifetimeValue: { points: 25, fullAt: 250000 }, // log scale, AUD ex GST
    recency: { points: 20, fullWithinMonths: 12, zeroAfterMonths: 48 },
    lastJobSize: { points: 15, fullAt: 30000 },
    repeat: { points: 15, fullAtJobs: 6 },
    openQuotes: { points: 10, fullAt: 50000 },
    angle: { points: 15 }, // × top angle weight / 100
  },

  // ── Email ─────────────────────────────────────────────────────────────
  email: {
    signer: "Sam Burke",
    title: "Commercial Manager",
    company: "RAS-VERTEX",
    phone: "07 5371 0201",
    greeting: "Hi {first},",
    intro: "Hope the year has treated you well. Before things wind down for Christmas, I'm checking in with the clients we've worked with to see if there's anything we can help with.",
    outro: "And if anything else is on the list at {site} (painting, height safety, waterproofing, window cleaning or general maintenance), just reply here and we'll get it sorted before the break or first thing in the new year.",
    signoff: "Cheers,",
    // Used when several selected clients share one email address
    // (e.g. a strata manager): one combined email lists every building.
    combinedSubject: "Pre-Christmas check-in: your buildings",
    combinedLead: "Across the buildings we look after with you, a few things came up:",
    combinedOutro: "Just reply with whichever you'd like quoted and I'll get them moving.",
  },
};

export type ServiceKey = "painting" | "wash" | "windows" | "anchors" | "waterproofing" | "ropeAccess" | "maintenance";
export type AngleId = keyof typeof CHECKIN_CONFIG.angles;
