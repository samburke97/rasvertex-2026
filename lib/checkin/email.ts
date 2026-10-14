// lib/checkin/email.ts
//
// Builds the pre-Christmas check-in email for a client from one of their
// angles: greeting + intro + the angle's paragraph + outro + sign-off, all
// worded in config.ts. Used by the page (draft box) and the CSV export.

import { CHECKIN_CONFIG } from "./config";
import { fill, type Angle, type CheckinClient } from "./analyse";

const E = CHECKIN_CONFIG.email;

export function composeEmail(c: Pick<CheckinClient, "first" | "site">, angle: Angle | undefined) {
  const v = { first: c.first || "there", site: angle?.site || c.site || "your property" };
  const sign = `${E.signoff}\n${E.signer}\n${E.title}, ${E.company}\n${E.phone}`;
  const body = [fill(E.greeting, v), fill(E.intro, v), angle?.para, fill(E.outro, v), sign].filter(Boolean).join("\n\n");
  return { subject: angle?.subject || `Pre-Christmas check-in from ${E.company}`, body };
}

/** The angle the email should use: the chosen one, else the client's lead. */
export function pickAngle(c: CheckinClient, angleId?: string | null): Angle | undefined {
  const all = [...c.angles, ...c.alternatives].filter((a) => !a.blocker);
  return all.find((a) => a.id === (angleId || c.leadAngle)) ?? all[0];
}
