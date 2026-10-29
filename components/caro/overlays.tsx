"use client";
// components/caro/overlays.tsx — Caro's sheets and floating bits: site record,
// client record (check-in), composer, new recurring job, SimPRO quote,
// confirm, toast and the selection bar.

import { useEffect, useState } from "react";
import { RECURRING_CATEGORIES } from "@/lib/recertifications/categories";
import type { CheckinClient } from "@/lib/checkin/analyse";
import { composeEmail, pickAngle } from "@/lib/checkin/email";
import { LINE, LINES, ME, OWNERS, derive, fmt, mergeVals, money, money2, parse, today, type Chase } from "@/lib/caro/data";
import { useCaro } from "./CaroPage";
import { initials, nextStep, plural, statusOf, telHref, timelineFor, TL_ICON } from "./helpers";
import { Ic, P } from "./icons";
import { MergeChips, MergeHtml } from "./views";

const Close = ({ onClick }: { onClick: () => void }) => (
  <button className="icon-btn icon-btn--round" onClick={onClick} title="Close">
    <Ic d={P.close} s={13} sw={2} />
  </button>
);
/** Backdrop that closes only when the backdrop itself is clicked. */
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

/* ---------- site record ---------- */
export function SiteRecord() {
  const { S, X, set, act } = useCaro();
  const s = X.find((x) => x.key === S.record);
  if (!s || !S.recDraft) return null;
  const L = LINE[s.line];
  const st = statusOf(s);
  const d = s.d;
  const tl = timelineFor(s, S.timing);
  const who = s.first || s.contact || "them";
  const facts: [string, string][] = [];
  if (s.reminded?.opened) facts.push([P.eye, `Opened reminder ${s.reminded.opened}×`]);
  facts.push([P.repeat, `Customer since ${s.since}`]);
  if (today().getFullYear() - s.priceSince >= 2) facts.push([P.tag, `Price unchanged since ${s.priceSince}`]);
  if (s.ltv) facts.push([P.users, `${money(s.ltv)} with us all up`]);
  const dr = S.recDraft;
  const dirty = Number(dr.price) !== s.price || Number(dr.interval) !== s.interval || dr.owner !== s.owner;
  const priceOk = Number(String(dr.price).replace(/[$,\s]/g, "")) > 0;
  const menu = (k: string) => S.recMenu === k;
  const toggleMenu = (k: string) => set({ recMenu: S.recMenu === k ? null : k });

  return (
    <Overlay onClose={act.closeRecord}>
      <div className="sheet sheet--site" role="dialog" aria-modal="true" aria-label={s.name}>
        <div className="sheet__head">
          <span className="tile" style={{ width: 34, height: 34, borderRadius: 10, fontSize: 12 }}>
            {initials(s.name)}
          </span>
          <div className="site-head__body">
            <span className="sheet__title truncate">{s.name}</span>
            <span className="sheet__sub">{[s.customer, s.suburb].filter(Boolean).join(" · ")}</span>
          </div>
          {s.checkinId && (
            <button className="text-btn" onClick={() => act.openClient(s.checkinId!)}>
              Client history
            </button>
          )}
          <Close onClick={act.closeRecord} />
        </div>
        <div className="sheet__body">
          <div className="site-sum">
            <div className="site-sum__main">
              <span className="site-sum__value">{money2(s.price)}</span>
              <span className="site-sum__meta">
                {L.name} · every {s.interval} months · {d.days < 0 ? "overdue since" : "due"} {fmt(d.next)}
              </span>
            </div>
            <span className={`pill pill--${st.pill}`}>{st.label}</span>
          </div>
          <div className="site-next">
            <Ic d={P.info} s={15} sw={1.7} />
            <span>{nextStep(s, S.timing)}</span>
          </div>
          {(s.doNotSend || s.blockers.length > 0 || !s.email) && (
            <div className="banner banner--amber site-warn">
              <Ic d={P.alert} s={15} sw={2} />
              <span>
                {[s.doNotSend ? "Marked do not send in SimPRO — call instead" : "", !s.email ? "No email on file" + (s.phone ? `, call ${s.phone}` : "") : "", ...s.blockers]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          )}
          <div className="facts">
            {facts.map(([icon, text]) => (
              <span className="fact" key={text}>
                <Ic d={icon} s={12} sw={1.8} />
                {text}
              </span>
            ))}
          </div>
          <div className="site-actions">
            {s.phone && (
              <a className="btn btn--neutral btn--md" href={telHref(s.phone)}>
                <Ic d={P.phone} s={13} sw={1.7} />
                Call {who}
              </a>
            )}
            <div className="pop-wrap pop-wrap--left" data-pop>
              <button className="btn btn--neutral btn--md" onClick={() => toggleMenu("log")}>
                Log a call
                <Ic d={P.chevD} s={11} sw={2.4} />
              </button>
              {menu("log") && (
                <div className="menu" role="menu">
                  <div className="menu__head">How did it go?</div>
                  <div className="menu__item" onClick={() => act.logCall("booked")}>
                    <Ic d={P.cal} s={14} />
                    Booked it
                  </div>
                  <div className="menu__item" onClick={() => act.logCall("later")}>
                    <Ic d={P.clock} s={14} />
                    Call back in 2 weeks
                  </div>
                  <div className="menu__item" onClick={() => act.logCall("none")}>
                    <Ic d={P.phone} s={14} />
                    No answer — try again in 2 days
                  </div>
                  {s.reminded && !s.reminded.replied && (
                    <div className="menu__item" onClick={() => act.logCall("replied")}>
                      <Ic d={P.reply} s={14} />
                      They replied — waiting on a date
                    </div>
                  )}
                </div>
              )}
            </div>
            <button className="btn btn--neutral btn--md" onClick={() => act.composeOne(s.key)} disabled={s.doNotSend}>
              <Ic d={P.mail} s={13} sw={1.7} />
              {s.reminded ? "Send another" : "Send reminder"}
            </button>
            {s.source === "simpro" && (
              <button className="btn btn--neutral btn--md" onClick={() => act.openQuote(s.key)}>
                <Ic d={P.quote} s={13} sw={1.7} />
                Create quote
              </button>
            )}
            <span className="site-actions__spacer" />
            <div className="pop-wrap" data-pop>
              <button className="icon-btn icon-btn--outline" onClick={() => toggleMenu("more")} title="More">
                <Ic d={P.more} s={16} sw={2.6} />
              </button>
              {menu("more") && (
                <div className="menu" role="menu">
                  {s.booked ? (
                    <div className="menu__item" onClick={act.unbook}>
                      <Ic d={P.close} s={14} />
                      Clear booking
                    </div>
                  ) : (
                    <div className="menu__item" onClick={act.snooze}>
                      <Ic d={P.clock} s={14} />
                      Snooze 30 days
                    </div>
                  )}
                  <div className="menu__item" onClick={() => act.reviewPrice(s.key)}>
                    <Ic d={P.tag} s={14} />
                    Change price or timing
                  </div>
                  <div className="menu__item menu__item--danger" onClick={act.askStop}>
                    <Ic d={P.stop} s={14} />
                    Stop recurring
                  </div>
                </div>
              )}
            </div>
            <button className="btn btn--primary btn--md" onClick={act.bookOne} disabled={!!s.booked}>
              <Ic d={P.cal} s={13} sw={1.8} />
              {s.booked ? "Booked" : "Mark booked"}
            </button>
          </div>
          <div className="tabs site-tabs" role="tablist">
            <button className="tabs__tab" role="tab" onClick={() => set({ recTab: "timeline" })} aria-selected={S.recTab === "timeline"}>
              Timeline <span className="badge">{tl.length}</span>
            </button>
            <button className="tabs__tab" role="tab" onClick={() => set({ recTab: "details" })} aria-selected={S.recTab === "details"}>
              Details
            </button>
          </div>
          {S.recTab === "timeline" ? (
            <div className="rtl">
              {tl.map((e, i) => {
                const [icon, tone] = TL_ICON[e.kind] ?? TL_ICON.note;
                return (
                  <div className="rtl__item" key={i}>
                    <div className="rtl__rail">
                      <span className={`rtl__icon${tone ? " rtl__icon--" + tone : ""}`}>
                        <Ic d={icon} s={14} sw={1.8} />
                      </span>
                      <span className="rtl__line" />
                    </div>
                    <div className="rtl__text">
                      <div className="rtl__top">
                        <span>{e.title}</span>
                        <time>{fmt(parse(e.date))}</time>
                      </div>
                      {e.detail && <span className="rtl__detail">{e.detail}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="details">
              <Detail label="Contact" value={s.contact || s.first || "—"} />
              <div className="details__item">
                <span className="details__label">Email</span>
                {s.email ? (
                  <a className="details__val" href={`mailto:${s.email}`}>
                    {s.email}
                  </a>
                ) : (
                  <span className="details__val">—</span>
                )}
              </div>
              <div className="details__item">
                <span className="details__label">Phone</span>
                {s.phone ? (
                  <a className="details__val" href={telHref(s.phone)}>
                    {s.phone}
                  </a>
                ) : (
                  <span className="details__val">—</span>
                )}
              </div>
              <Detail label="Account" value={s.customer} />
              <Detail label="Site" value={[s.name, s.address, s.suburb].filter(Boolean).join(", ")} />
              <Detail label="Service" value={`${L.name} · ${L.service}`} hint={s.jobId ? `Last job #${s.jobId} in SimPRO` : undefined} />
              <label className="details__item">
                <span className="details__label">Price (ex GST)</span>
                <input
                  className={`input${priceOk ? "" : " is-error"}`}
                  data-focus="recPrice"
                  inputMode="decimal"
                  value={dr.price}
                  onChange={(e) => set({ recDraft: { ...dr, price: e.target.value } })}
                />
                <span className="details__hint">Set in {s.priceSince}</span>
              </label>
              <label className="details__item">
                <span className="details__label">Repeats every</span>
                <select className="input" value={dr.interval} onChange={(e) => set({ recDraft: { ...dr, interval: Number(e.target.value) } })}>
                  {[3, 6, 12, 24].map((m) => (
                    <option key={m} value={m}>
                      {m} months
                    </option>
                  ))}
                </select>
                <span className="details__hint">Last done {fmt(parse(s.lastDone))}</span>
              </label>
              <label className="details__item">
                <span className="details__label">Account owner</span>
                <select className="input" value={dr.owner} onChange={(e) => set({ recDraft: { ...dr, owner: e.target.value } })}>
                  {OWNERS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="details__foot">
                <span className="t-caption">{dirty ? "Unsaved changes" : "Changes are logged on the timeline."}</span>
                <button className="btn btn--neutral btn--md" onClick={act.resetRecDraft} disabled={!dirty}>
                  Discard
                </button>
                <button className="btn btn--primary btn--md" onClick={act.saveRecDraft} disabled={!(dirty && priceOk)}>
                  Save changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}
const Detail = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="details__item">
    <span className="details__label">{label}</span>
    <span className="details__val">{value}</span>
    {hint && <span className="details__hint">{hint}</span>}
  </div>
);

/* ---------- client record (check-in) ---------- */
export function ClientRecord() {
  const { S, X, act } = useCaro();
  const id = S.client;
  const [client, setClient] = useState<CheckinClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [angleId, setAngleId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setClient(null);
    setError(null);
    setAngleId(null);
    fetch(`/api/checkin/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load client");
        if (!cancelled) setClient(data.client);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load client"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!client) return;
    const email = composeEmail(client, pickAngle(client, angleId));
    setSubject(email.subject);
    setBody(email.body);
  }, [client, angleId]);

  if (!id) return null;
  const sites = X.filter((s) => s.customerId === id);
  const chosen = client ? pickAngle(client, angleId) : undefined;
  const options = client ? [...client.angles, ...client.alternatives].filter((a) => !a.blocker) : [];
  const blockers = client?.angles.filter((a) => a.blocker) ?? [];
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      act.toast(`${what} copied.`);
    } catch {
      act.toast("Couldn’t copy. Select the text and copy it manually.");
    }
  };
  const row = S.clientRows?.find((r) => r.id === id);
  const title = client?.name ?? row?.name ?? sites[0]?.customer ?? "Client";

  return (
    <Overlay onClose={act.closeClient}>
      <div className="sheet sheet--site" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__head">
          <span className="tile" style={{ width: 34, height: 34, borderRadius: 10, fontSize: 12 }}>
            {initials(title)}
          </span>
          <div className="site-head__body">
            <span className="sheet__title truncate">{title}</span>
            <span className="sheet__sub">{client ? [client.type, client.contactName, client.email].filter(Boolean).join(" · ") : "Loading…"}</span>
          </div>
          {client?.phone && (
            <a className="icon-btn icon-btn--outline icon-btn--round" href={telHref(client.phone)} title={`Call ${client.phone}`} style={{ width: 34, height: 34 }}>
              <Ic d={P.phone} s={15} />
            </a>
          )}
          <Close onClick={act.closeClient} />
        </div>
        <div className="sheet__body">
          {error ? (
            <div className="empty">
              <span className="empty__title">Couldn’t load this client</span>
              <span className="empty__sub">{error}</span>
            </div>
          ) : !client ? (
            <div className="client-body">
              {[70, 50, 90, 40].map((w, i) => (
                <span key={i} className="sk sk--title" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <div className="client-body">
              <div className="site-next" style={{ margin: 0 }}>
                <Ic d={P.info} s={15} sw={1.7} />
                <span>{client.summary}</span>
              </div>
              {(blockers.length > 0 || !client.email || client.sharedWith.length > 0 || client.inProgress.length > 0) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {blockers.map((a) => (
                    <div key={a.id} className="banner banner--red">
                      <Ic d={P.alert} s={15} sw={2} />
                      {a.title}
                    </div>
                  ))}
                  {!client.email && <div className="banner banner--amber">No email on file{client.phone ? `. Call ${client.phone}` : ""}.</div>}
                  {client.sharedWith.length > 0 && (
                    <div className="banner banner--amber">This email also covers {client.sharedWith.join(", ")}. Consider one email for all of them.</div>
                  )}
                  {client.inProgress.length > 0 && <div className="banner banner--amber">In progress: {client.inProgress.join("; ")}</div>}
                </div>
              )}

              {sites.length > 0 && (
                <section className="client-sec">
                  <span className="t-label">On recurring</span>
                  <div className="list">
                    {sites.map((s) => {
                      const st = statusOf(s);
                      return (
                        <div className="row" key={s.key} onClick={() => act.openRecord(s.key)}>
                          <div className="row__main">
                            <span className="row__title truncate">{s.name}</span>
                            <span className="row__sub">
                              {LINE[s.line].name} · {s.d.days < 0 ? `overdue ${-s.d.days} days` : `due ${fmt(s.d.next)}`}
                            </span>
                          </div>
                          <span className={`state state--${st.tone}`}>{st.text}</span>
                          <span className="row__value">{money(s.price)}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {options.length > 0 && (
                <section className="client-sec">
                  <span className="t-label">Follow-up angle</span>
                  <div className="angles">
                    {options.map((a) => (
                      <button key={a.id} className="angle" aria-pressed={chosen?.id === a.id} onClick={() => setAngleId(a.id)}>
                        <span className="angle__radio" />
                        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="angle__title">{a.title}</span>
                          <span className="angle__reason">{a.reason}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="client-sec">
                <span className="t-label">Check-in email{client.email ? ` to ${client.email}` : ""}</span>
                <div className="field">
                  <span className="field__label">Subject</span>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="field">
                  <span className="field__label">Message</span>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="t-caption" style={{ flex: 1 }}>
                    Edit freely. Nothing is sent from here.
                  </span>
                  <button className="btn btn--neutral btn--sm" onClick={() => copy(subject, "Subject")}>
                    Copy subject
                  </button>
                  <button className="btn btn--primary btn--sm" onClick={() => copy(body, "Email")}>
                    <Ic d={P.copy} s={12} sw={1.8} />
                    Copy email
                  </button>
                </div>
              </section>

              <section className="client-sec">
                <span className="t-label">Client</span>
                <div className="details" style={{ padding: 0 }}>
                  <Detail label="Contact" value={client.contactName || "—"} hint={client.email || "No email"} />
                  <Detail label="Phone" value={client.phone || "—"} />
                  <Detail label="Sites" value={String(client.siteCount)} hint={[client.site, client.suburb].filter(Boolean).join(", ")} />
                  <Detail label="Jobs" value={`${client.jobCount} · ${money(client.ltv)}`} hint="Lifetime, ex GST" />
                  <Detail
                    label="First / last job"
                    value={client.firstJob ? `${fmt(parse(client.firstJob))} → ${client.lastJob?.date ? fmt(parse(client.lastJob.date)) : "—"}` : "—"}
                    hint={client.monthsSince != null ? `${client.monthsSince} months ago` : undefined}
                  />
                  <Detail label="Cost centres" value={client.costCentres.join(", ") || "—"} />
                </div>
              </section>

              {client.unpaid.length > 0 && (
                <section className="client-sec">
                  <span className="t-label">Unpaid invoices</span>
                  <table className="mini">
                    <tbody>
                      {client.unpaid.map((i) => (
                        <tr key={i.id}>
                          <td>#{i.id}</td>
                          <td className="muted">
                            Issued {fmt(parse(i.issued))} · due {fmt(parse(i.due))}
                          </td>
                          <td>{i.overdue && <span className="pill pill--overdue">Overdue</span>}</td>
                          <td className="num">{money(i.owing)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {client.openQuotes.length > 0 && (
                <section className="client-sec">
                  <span className="t-label">Open quotes</span>
                  <table className="mini">
                    <tbody>
                      {client.openQuotes.map((q) => (
                        <tr key={q.id}>
                          <td>#{q.id}</td>
                          <td>
                            {q.name}
                            <div className="muted">
                              {q.status} · {fmt(parse(q.issued))} · {q.age} days
                            </div>
                          </td>
                          <td className="num">{money(q.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <section className="client-sec">
                <span className="t-label">Job history ({client.jobs.length})</span>
                {client.jobs.length === 0 ? (
                  <span className="t-meta">No jobs on record.</span>
                ) : (
                  <table className="mini">
                    <tbody>
                      {client.jobs.map((j) => (
                        <tr
                          key={j.id}
                          className={j.unconfirmed ? "is-unconfirmed" : undefined}
                          title={j.unconfirmed ? "ServiceM8 import that never reached Fully-paid: likely a lost quote or unfinished work. Not counted." : undefined}
                        >
                          <td style={{ whiteSpace: "nowrap" }}>{j.active ? <span className="pill pill--booked">In progress</span> : j.date ? fmt(parse(j.date)) : "—"}</td>
                          <td>
                            {j.desc || `Job #${j.id}`}
                            <div className="muted">{[`#${j.id}`, j.cc, j.site].filter(Boolean).join(" · ")}</div>
                          </td>
                          <td className="num">{money(j.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ---------- composer ---------- */
const FOLLOW: [Chase, string][] = [
  ["none", "Do nothing"],
  ["follow", "Send a follow-up"],
  ["flag", "Flag for a call"],
];
export function Composer() {
  const { S, X, set, act, mergeFocus } = useCaro();
  const c = S.compose;
  if (!c) return null;
  const rec = X.filter((s) => c.keys.includes(s.key));
  const tpl = S.templates.find((t) => t.id === c.tplId);
  const first = rec[0];
  const lines = [...new Set(rec.map((s) => s.line))];
  const t = S.timing[first?.line ?? "hs"];
  const same = lines.length <= 1;
  const unsendable = rec.filter((s) => s.doNotSend || !s.email);
  const notes: Record<Chase, string> = {
    none: "Nothing else happens. You’ll only hear back if they reply.",
    follow: same
      ? `A short follow-up is due after ${t.follow} days for anyone who hasn’t replied. After ${t.flag} days they show under Needs you.`
      : "A short follow-up is due for anyone who hasn’t replied, using each service line’s timing. Then they show under Needs you.",
    flag: same
      ? `No follow-up email. Anyone who hasn’t replied after ${t.flag} days shows under Needs you to call.`
      : "No follow-up email. Anyone who hasn’t replied shows under Needs you to call, using each service line’s timing.",
  };
  const ok = rec.length > 0 && c.body.trim() && c.subject.trim() && !c.sending;
  const vals = first ? mergeVals(first, first.d, ME) : {};
  const edit = (k: "subject" | "body", v: string) => set({ compose: { ...c, [k]: v } });
  const focus = (path: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (mergeFocus.current = { path, el: e.target });
  const n = rec.length - unsendable.length;

  return (
    <Overlay onClose={act.closeCompose}>
      <div className="sheet sheet--compose" role="dialog" aria-modal="true">
        <div className="sheet__head">
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="sheet__title">{rec.length === 1 ? "Send reminder" : `Send reminders to ${rec.length} sites`}</span>
            <span className="sheet__sub">{S.live ? `From ${ME.email}` : `Test mode — one sample goes to ${S.testTo}, nothing reaches clients`}</span>
          </div>
          <div className="seg seg--sm">
            <button className="seg__btn" onClick={() => set({ compose: { ...c, mode: "write" } })} aria-pressed={c.mode === "write"}>
              Write
            </button>
            <button className="seg__btn" onClick={() => set({ compose: { ...c, mode: "preview" } })} aria-pressed={c.mode === "preview"}>
              Preview
            </button>
          </div>
          <Close onClick={act.closeCompose} />
        </div>
        <div className="sheet__body">
          <div className="compose">
            <div className="compose__line">
              <span className="t-label">To</span>
              <div className="rcpts">
                {rec.slice(0, 6).map((s) => (
                  <span className={`rcpt${s.doNotSend || !s.email ? " rcpt--warn" : ""}`} key={s.key} title={s.doNotSend ? "Do not send" : !s.email ? "No email on file" : s.email}>
                    {(s.first || s.contact || "No contact") + " · " + s.name}
                    <button onClick={() => set({ compose: { ...c, keys: c.keys.filter((x) => x !== s.key) } })} title="Remove">
                      <Ic d={P.close} s={9} sw={2.6} />
                    </button>
                  </span>
                ))}
                {rec.length > 6 && <span className="rcpts__more">+{rec.length - 6} more</span>}
                {!rec.length && <span className="t-meta">Nobody left — close and pick some sites.</span>}
              </div>
            </div>
            {unsendable.length > 0 && (
              <div className="banner banner--amber">
                <Ic d={P.alert} s={15} sw={2} />
                {plural(unsendable.length, "site")} will be skipped — no email on file or marked do not send.
              </div>
            )}
            <div className="compose__line">
              <span className="t-label">Template</span>
              <div className="pop-wrap pop-wrap--left" data-pop>
                <button className="btn btn--quiet" onClick={() => set({ composeMenu: !S.composeMenu })}>
                  {tpl ? tpl.name : "Custom"}
                  <Ic d={P.chevD} s={11} sw={2.4} />
                </button>
                {S.composeMenu && (
                  <div className="menu" role="listbox">
                    {S.templates.map((x) => (
                      <div key={x.id} className="menu__item" onClick={() => set({ composeMenu: false, compose: { ...c, tplId: x.id, subject: x.subject, body: x.body } })}>
                        <span className="menu__tick">{x.id === c.tplId && <Ic d={P.check} s={11} sw={3} />}</span>
                        {x.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {c.mode === "write" ? (
              <>
                <div className="field">
                  <span className="field__label">Subject</span>
                  <input data-model="compose.subject" value={c.subject} onFocus={focus("compose.subject")} onChange={(e) => edit("subject", e.target.value)} />
                </div>
                <div className="field">
                  <span className="field__label">Message</span>
                  <textarea data-model="compose.body" value={c.body} onFocus={focus("compose.body")} onChange={(e) => edit("body", e.target.value)} />
                </div>
                <MergeChips target="compose.body" />
              </>
            ) : (
              first && (
                <div className="mail-preview">
                  <span className="mail-preview__meta">
                    Previewing for {first.first || first.contact || "the contact"} · {first.email || "no email on file"}
                  </span>
                  <span className="mail-preview__subject">
                    <MergeHtml text={c.subject} vals={vals} />
                  </span>
                  <span className="mail-preview__body">
                    <MergeHtml text={c.body} vals={vals} />
                  </span>
                </div>
              )
            )}
            <div className="follow">
              <span className="t-label">If there’s no reply</span>
              <div className="seg seg--sm">
                {FOLLOW.map(([k, label]) => (
                  <button key={k} className="seg__btn" onClick={() => set({ compose: { ...c, follow: k } })} aria-pressed={c.follow === k}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="follow__note">{notes[c.follow]}</span>
            </div>
          </div>
        </div>
        <div className="sheet__foot">
          <span className="t-caption">Each email is personalised to the site, signed by you, and carries an unsubscribe link.</span>
          <button className="btn btn--neutral btn--md" onClick={act.closeCompose}>
            Cancel
          </button>
          <button className="btn btn--primary btn--md" onClick={act.send} disabled={!ok}>
            <Ic d={P.send} s={13} sw={1.8} />
            {c.sending ? "Sending…" : !S.live ? "Send test" : n === 1 ? "Send reminder" : `Send ${n} reminders`}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---------- new recurring job ---------- */
export function NewSite() {
  const { S, set, act } = useCaro();
  const f = S.newSite;
  if (!f) return null;
  const e = f.errors;
  const upd = (k: string, v: string) => set({ newSite: { ...f, [k]: v } });
  const field = (k: keyof typeof f & string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span = false) => (
    <label className={`input-wrap${span ? " span-2" : ""}`}>
      <span className="input-label">{label}</span>
      <input className={`input${e[k] ? " is-error" : ""}`} value={String(f[k])} onChange={(ev) => upd(k, ev.target.value)} {...props} />
      {e[k] && <span className="form-err">{e[k]}</span>}
    </label>
  );
  return (
    <Overlay onClose={() => set({ newSite: null })}>
      <div className="sheet sheet--form" role="dialog" aria-modal="true">
        <div className="sheet__head">
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="sheet__title">New recurring job</span>
            <span className="sheet__sub">For work that isn’t in SimPRO yet. Reminders follow the service line’s timing.</span>
          </div>
          <Close onClick={() => set({ newSite: null })} />
        </div>
        <div className="sheet__body">
          <div className="form-grid">
            <div className="input-wrap span-2">
              <span className="input-label">Service line</span>
              <div className="seg">
                {LINES.map((l) => (
                  <button key={l.key} className="seg__btn" onClick={() => set({ newSite: { ...f, line: l.key, interval: S.timing[l.key].interval } })} aria-pressed={f.line === l.key}>
                    <span className="dot" style={{ "--dot": l.dot } as React.CSSProperties} />
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            {field("customer", "Site or account name", { placeholder: "e.g. Seachange Apartments" }, true)}
            {field("address", "Street address", { placeholder: "12 Ocean St" })}
            {field("suburb", "Suburb", { placeholder: "Mooloolaba" })}
            {field("first", "Contact first name", { placeholder: "Sarah" })}
            {field("email", "Contact email", { type: "email", placeholder: "sarah@seachange.com.au" })}
            {field("phone", "Phone", { placeholder: "0412 345 678" })}
            {field("price", "Price ex GST", { inputMode: "decimal", placeholder: "1,000" })}
            <label className="input-wrap">
              <span className="input-label">Repeats every</span>
              <select className="input" value={f.interval} onChange={(ev) => set({ newSite: { ...f, interval: Number(ev.target.value) } })}>
                {[3, 6, 12, 24].map((m) => (
                  <option key={m} value={m}>
                    {m} months
                  </option>
                ))}
              </select>
            </label>
            {field("lastDone", "Last done", { type: "date" })}
          </div>
        </div>
        <div className="sheet__foot">
          <span className="t-caption">You can change any of this later.</span>
          <button className="btn btn--neutral btn--md" onClick={() => set({ newSite: null })}>
            Cancel
          </button>
          <button className="btn btn--primary btn--md" onClick={act.addSite}>
            Add recurring job
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---------- SimPRO quote ---------- */
export function QuoteModal() {
  const { S, act } = useCaro();
  const s = S.sites.find((x) => x.key === S.quote);
  if (!s) return null;
  const cfg = RECURRING_CATEGORIES[LINE[s.line].category];
  const next = derive(s, S.timing[s.line]).next;
  const year = Math.max(next.getFullYear(), today().getFullYear());
  const newEx = Math.round(s.price * 1.05 * 100) / 100;
  const due = new Date();
  due.setDate(due.getDate() + 14);
  const rows: [string, string, boolean?][] = [
    ["Quote name", cfg.quoteName(year), true],
    ["Customer", s.customer],
    ["Site", s.name],
    ["Last price (ex GST)", money2(s.price)],
    ["New price (ex GST) +5%", money2(newEx), true],
    ["New price (inc GST)", money2(Math.round(newEx * 1.1 * 100) / 100)],
    ["Due date", fmt(due)],
  ];
  return (
    <Overlay onClose={act.closeQuote}>
      <div className="modal modal--wide" role="dialog" aria-modal="true">
        <div className="modal__icon modal__icon--blue">
          <Ic d={P.quote} s={18} sw={1.7} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 className="modal__title">Create a quote in SimPRO?</h3>
          <p className="modal__body">It’s added to {s.customer} in SimPRO, and the site is marked booked here.</p>
        </div>
        <div className="kv">
          {rows.map(([k, v, hi]) => (
            <div className="kv__row" key={k}>
              <span>{k}</span>
              {hi ? <b>{v}</b> : <span>{v}</span>}
            </div>
          ))}
        </div>
        <div className="modal__actions">
          <button className="btn btn--neutral btn--md" onClick={act.closeQuote} disabled={S.quoteBusy}>
            Cancel
          </button>
          <button className="btn btn--primary btn--md" onClick={act.createQuote} disabled={S.quoteBusy}>
            {S.quoteBusy ? "Creating…" : "Create in SimPRO"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---------- confirm, toast, selection bar ---------- */
export function ConfirmModal() {
  const { S, set, act } = useCaro();
  const c = S.confirm;
  if (!c) return null;
  return (
    <Overlay onClose={() => set({ confirm: null })}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal__icon">
          <Ic d={c.icon || P.trash} s={18} sw={1.7} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 className="modal__title">{c.title}</h3>
          <p className="modal__body">{c.body}</p>
        </div>
        <div className="modal__actions">
          <button className="btn btn--neutral btn--md" onClick={() => set({ confirm: null })}>
            Cancel
          </button>
          <button className="btn btn--danger btn--md" onClick={act.doConfirm}>
            {c.cta}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function Toast() {
  const { S, act } = useCaro();
  if (!S.toast) return null;
  const raised = S.selected.length > 0 && ["overview", "sites"].includes(S.view);
  return (
    <div className={`rj-toast${raised ? " is-raised" : ""}`} role="status">
      <div className="toast">
        <Ic d={P.check} s={14} sw={2.4} />
        <span>{S.toast.text}</span>
        {S.toast.undo && (
          <button className="toast__undo" onClick={act.undo}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

export function SelectionBar() {
  const { S, X, act } = useCaro();
  if (!S.selected.length || !["overview", "sites"].includes(S.view)) return null;
  const sel = X.filter((s) => S.selected.includes(s.key));
  return (
    <div className="rj-float">
      <div className="selection-bar">
        <span className="selection-bar__label">
          {sel.length} selected · {money(sel.reduce((a, s) => a + s.price, 0))}
        </span>
        <button className="selection-bar__btn" onClick={act.bulkRemind}>
          Send {plural(sel.length, "reminder")}
        </button>
        <button className="selection-bar__ghost" onClick={act.bulkBook}>
          Mark booked
        </button>
        <button className="selection-bar__ghost" onClick={act.clearSelection}>
          Clear
        </button>
      </div>
    </div>
  );
}
