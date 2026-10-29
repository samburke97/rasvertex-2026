// lib/outreach/templates.ts
//
// Email templates for customer outreach, one set per rule: the first email
// and each follow-up. Filled from the opportunity's SimPRO details, then
// shown in the review queue where staff can edit before sending.
//
// Merge values available to every template (see vars() below):
//   first      contact's first name, or "there"
//   site       building/site name
//   job        trigger job name (job rules) / quote name (quote rule)
//   month      month + year the job completed / the quote was sent
//   date       full date the job completed / the quote was sent
//   dueMonth   month + year of the 12-month anniversary
//   ago        "about a year" / "over a year" since the job
//   dueWhen    "is due around July 2026" / "was due in July 2026 and is now overdue"
//   dueShort   "due July 2026" / "overdue" (for subjects)
//   bookAsk    "...book it in before then?" / "...book it in as soon as possible?"
//   quoteNo    "Q10614" (quote rule)
//   phone      company phone

import { COMPANY_PHONE } from "@/lib/reports/proposal/v3/types";
import { OUTREACH_SIGNER } from "./email";
import { OUTREACH_RULES, type OutreachRuleId } from "./rules";
import type { Opportunity } from "./store";

interface Template {
  subject: string;
  body: string;
}

// templates[n] is email n+1; must cover 1 + rule.followUpDays.length emails.
const TEMPLATES: Record<OutreachRuleId, Template[]> = {
  "painting-wash": [
    {
      subject: "{site}: a year on from the painting",
      body: `Hi {first},

It's been {ago} since our team completed the painting at {site} in {month}, so I wanted to get in touch about keeping that finish in good shape.

An annual gentle wash removes the dirt, salt and mould that break paint down early. It keeps the building looking freshly painted, and it's what paint manufacturers like Dulux and Haymes recommend to keep their coating warranties valid.

We can do the wash with our own team, the same people who did the painting. Would you like me to put a quote together? Just reply to this email or call {phone}.`,
    },
    {
      subject: "Following up: building wash for {site}",
      body: `Hi {first},

Just following up on my note about an annual building wash for {site}. It's a good time to book it in before the grime has a chance to set into the new paint.

Happy to arrange a quote whenever suits. Just reply here or call {phone}.`,
    },
    {
      subject: "Building wash for {site}",
      body: `Hi {first},

One last note from me on the building wash for {site}. If now isn't the right time, no problem at all. Whenever you'd like a quote, just reply to this email and I'll organise it.`,
    },
  ],
  "waterproofing-inspection": [
    {
      subject: "{site}: 12-month waterproofing check",
      body: `Hi {first},

It's been {ago} since we completed the waterproofing work at {site} in {month}, so I wanted to suggest a quick 12-month inspection.

We check the membrane, joints, sealants and drainage outlets. Small things like cracked sealant or a blocked outlet are cheap to fix now, and expensive once water gets through.

Would you like us to book it in? Just reply to this email or call {phone}.`,
    },
    {
      subject: "Following up: waterproofing check for {site}",
      body: `Hi {first},

Just following up on my note about a 12-month waterproofing inspection at {site}. It's a quick visit, and the best way to catch small issues before they turn into leaks.

Happy to book a time that suits. Just reply here or call {phone}.`,
    },
    {
      subject: "Waterproofing check for {site}",
      body: `Hi {first},

One last note from me on the waterproofing inspection for {site}. If now isn't the right time, that's fine. Whenever you'd like us to take a look, just reply to this email and I'll organise it.`,
    },
  ],
  "height-safety-annual": [
    {
      subject: "{site}: anchor recertification {dueShort}",
      body: `Hi {first},

We last worked on the height safety system at {site} in {month}, so its annual inspection and recertification {dueWhen}.

AS/NZS 1891.4 requires anchor points and static lines to be inspected every 12 months, and contractors can't legally use the system once certification lapses.

{bookAsk} Just reply to this email or call {phone}.`,
    },
    {
      subject: "Following up: anchor recertification for {site}",
      body: `Hi {first},

Just following up on the annual anchor recertification for {site}, which {dueWhen}. Booking it in now keeps the system certified, so window cleaners and other contractors can keep using it.

Just reply here or call {phone} and we'll schedule it.`,
    },
    {
      subject: "Anchor recertification for {site}",
      body: `Hi {first},

A final reminder that the recertification of the height safety system at {site} {dueWhen}. If it's already been arranged, please disregard this. Otherwise, just reply and we'll get it booked.`,
    },
  ],
  "open-quote": [
    {
      subject: "Your quote for {site}",
      body: `Hi {first},

I wanted to check that our quote for {site} ({quoteNo}, "{job}"), sent on {date}, came through okay.

If you have any questions, or it would help to walk through the scope on site, I'm happy to arrange that. And if the timing or scope needs adjusting, just let me know.

You can reply to this email or call {phone}.`,
    },
    {
      subject: "Following up: your quote for {site}",
      body: `Hi {first},

Just following up on our quote for {site} ({quoteNo}, "{job}"). Is there anything you need from us to help with a decision? Happy to answer questions or adjust the scope.

Just reply here or call {phone}.`,
    },
    {
      subject: "Your quote for {site}",
      body: `Hi {first},

A final follow-up on our quote for {site} ({quoteNo}, "{job}"). If the work has been put on hold or gone another way, no problem, I'll close it off on our side. If you'd still like to go ahead, just reply and we'll get it scheduled.`,
    },
  ],
};

const SIGN_OFF = `Kind regards,

${OUTREACH_SIGNER.name}
${OUTREACH_SIGNER.title}
RAS-VERTEX Maintenance Solutions`;

function parse(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

function vars(o: Opportunity): Record<string, string> {
  const source = parse(o.sourceDate);
  const due = new Date(source);
  due.setMonth(due.getMonth() + 12);
  const monthYear = (d: Date) => d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const now = new Date();
  const monthsAgo = (now.getFullYear() - source.getFullYear()) * 12 + now.getMonth() - source.getMonth();
  // Overdue once the anniversary month has fully passed.
  const overdue = now.getFullYear() * 12 + now.getMonth() > due.getFullYear() * 12 + due.getMonth();
  return {
    ago: monthsAgo >= 15 ? "over a year" : "about a year",
    dueWhen: overdue
      ? `was due in ${monthYear(due)} and is now overdue`
      : `is due around ${monthYear(due)}`,
    dueShort: overdue ? "overdue" : `due ${monthYear(due)}`,
    bookAsk: overdue
      ? "Would you like us to book it in as soon as possible?"
      : "Would you like us to book the recertification in before then?",
    first: o.contactName.split(" ")[0] || "there",
    site: o.site,
    job: o.sourceName.trim(),
    month: monthYear(source),
    date: source.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
    dueMonth: monthYear(due),
    quoteNo: `Q${o.sourceId}`,
    phone: COMPANY_PHONE,
  };
}

function fill(text: string, v: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => v[key] ?? m);
}

/** The next email for an opportunity, from its rule's templates. */
export function templateEmail(o: Opportunity): { subject: string; body: string } {
  const set = TEMPLATES[o.ruleId];
  const t = set[Math.min(o.touchesSent, set.length - 1)];
  const v = vars(o);
  return { subject: fill(t.subject, v), body: `${fill(t.body, v)}\n\n${SIGN_OFF}` };
}

// Every rule must have a template for each of its emails.
for (const rule of Object.values(OUTREACH_RULES)) {
  if (TEMPLATES[rule.id].length < 1 + rule.followUpDays.length) {
    throw new Error(`Outreach rule ${rule.id} is missing email templates`);
  }
}
