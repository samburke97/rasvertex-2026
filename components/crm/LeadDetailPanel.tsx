"use client";
// components/crm/LeadDetailPanel.tsx
//
// The lead's detail modal: header + Email/Notes/Timeline tabs over the
// lead's activity log.
//
// The Email tab is a real outbound thread (subject+body per send, one bubble
// per LeadActivity row) with a composer at the bottom that absorbs what used
// to be the separate ComposeEmailModal directly. Tracking chips read
// deliveredAt/openedAt/clickedAt/bouncedAt off each activity row — those only
// populate once app/api/webhooks/resend/route.ts is registered as a webhook
// in the Resend dashboard; until then every sent email just shows "Sent".
// There's no inbound-reply capture in this app, so the thread only ever
// shows what was actually sent, not simulated replies.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./LeadDetailPanel.module.css";
import { type Lead, type LeadActivity } from "@/lib/crm/store";

interface LeadDetailPanelProps {
  leadId: number;
  onClose: () => void;
}

type Tab = "thread" | "notes" | "timeline";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LeadDetailPanel({ leadId, onClose }: LeadDetailPanelProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [activity, setActivity] = useState<LeadActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("thread");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`);
      if (!res.ok) throw new Error("Failed to fetch lead");
      const data = await res.json();
      setLead(data.lead);
      setActivity(data.activity ?? []);
    } catch (err) {
      console.error("[CRM] fetchLead failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setEmailError("Subject and message are both required.");
      return;
    }
    setSendingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to send email");
      setSubject("");
      setBody("");
      fetchLead();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNoteBody("");
      fetchLead();
    } catch (err) {
      console.error("[CRM] addNote failed:", err);
    } finally {
      setSavingNote(false);
    }
  };

  const emailActivity = useMemo(() => activity.filter((a) => a.type === "email"), [activity]);
  const noteActivity = useMemo(() => activity.filter((a) => a.type === "note"), [activity]);

  if (isLoading || !lead) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.box} onClick={(e) => e.stopPropagation()}>
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.headAvatar}>{initials(lead.name)}</div>
          <div className={styles.headWho}>
            <b>{lead.name}</b>
            <span>{lead.company || "No company on file"}</span>
          </div>
          {lead.phone && (
            <a className={styles.headCall} href={`tel:${lead.phone}`} title="Call this lead">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4h4l2 5-2 1a12 12 0 006 6l1-2 5 2v4a16 16 0 01-16-16z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          )}
          <button className={styles.headClose} onClick={onClose} aria-label="Close" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === "thread" ? styles.tabOn : ""}`}
            onClick={() => setTab("thread")}
          >
            Email <b>{emailActivity.length}</b>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "notes" ? styles.tabOn : ""}`}
            onClick={() => setTab("notes")}
          >
            Notes <b>{noteActivity.length}</b>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "timeline" ? styles.tabOn : ""}`}
            onClick={() => setTab("timeline")}
          >
            Timeline <b>{activity.length}</b>
          </button>
        </div>

        {tab === "thread" && (
          <>
            <div className={styles.pane}>
              {emailActivity.length === 0 ? (
                <p className={styles.paneEmpty}>No emails sent yet.</p>
              ) : (
                emailActivity.map((a) => <EmailMessage key={a.id} activity={a} />)
              )}
            </div>
            <div className={styles.composer}>
              {!lead.email ? (
                <p className={styles.composerBlocked}>
                  Add an email address above to send this lead a message.
                </p>
              ) : (
                <>
                  <div className={styles.composerSubject}>
                    <label htmlFor="compose-subject">Subject</label>
                    <input
                      id="compose-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject"
                      disabled={sendingEmail}
                    />
                  </div>
                  <textarea
                    className={styles.composerBody}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your message…"
                    rows={4}
                    disabled={sendingEmail}
                  />
                  {emailError && <p className={styles.error}>{emailError}</p>}
                  <div className={styles.composerFoot}>
                    <span className={styles.composerFrom}>From: Sam &lt;sam@rasvertex.com.au&gt;</span>
                    <button
                      type="button"
                      className={styles.sendBtn}
                      onClick={handleSend}
                      disabled={sendingEmail}
                    >
                      {sendingEmail ? "Sending…" : "Send"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {tab === "notes" && (
          <div className={styles.pane}>
            <div className={styles.notesNew}>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Log a call, add a note…"
                rows={2}
                disabled={savingNote}
              />
              <div className={styles.notesFoot}>
                <button
                  type="button"
                  className={styles.addNoteBtn}
                  onClick={handleAddNote}
                  disabled={savingNote || !noteBody.trim()}
                >
                  {savingNote ? "Adding…" : "Add note"}
                </button>
              </div>
            </div>
            {noteActivity.length === 0 ? (
              <p className={styles.paneEmpty}>No notes yet.</p>
            ) : (
              noteActivity.map((a) => (
                <div key={a.id} className={styles.note}>
                  <div className={styles.noteBody}>{a.body}</div>
                  <div className={styles.noteTime}>{formatTime(a.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "timeline" && (
          <div className={styles.pane}>
            {activity.length === 0 ? (
              <p className={styles.paneEmpty}>No activity yet.</p>
            ) : (
              <div className={styles.tl}>
                {activity.map((a) => (
                  <TimelineRow key={a.id} activity={a} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Email thread bubble + tracking chips ─────────────────────────────────────

function EmailMessage({ activity }: { activity: LeadActivity }) {
  return (
    <div className={styles.msg}>
      <div className={styles.msgHead}>
        <span className={styles.msgAuthor}>You</span>
        <span className={styles.msgTime}>{formatTime(activity.createdAt)}</span>
      </div>
      <div className={styles.msgBubble}>
        {activity.subject && <div className={styles.msgSubject}>{activity.subject}</div>}
        <div className={styles.msgBody}>{activity.body}</div>
        <div className={styles.track}>{trackingChips(activity)}</div>
      </div>
    </div>
  );
}

function trackingChips(activity: LeadActivity) {
  if (activity.emailStatus === "failed") {
    return <span className={`${styles.tag} ${styles.tagFailed}`}>Failed to send</span>;
  }
  if (activity.emailStatus === "queued" && !activity.deliveredAt) {
    return <span className={styles.tag}>Sending…</span>;
  }
  const chips: React.ReactNode[] = [
    <span key="sent" className={`${styles.tag} ${styles.tagSent}`}>
      Sent
    </span>,
  ];
  if (activity.deliveredAt) {
    chips.push(
      <span key="delivered" className={`${styles.tag} ${styles.tagSent}`}>
        Delivered
      </span>,
    );
  }
  if (activity.openedAt) {
    chips.push(
      <span key="opened" className={`${styles.tag} ${styles.tagOpen}`}>
        Opened
      </span>,
    );
  }
  if (activity.clickedAt) {
    chips.push(
      <span key="clicked" className={`${styles.tag} ${styles.tagClick}`}>
        Link clicked
      </span>,
    );
  }
  if (activity.bouncedAt) {
    chips.push(
      <span key="bounced" className={`${styles.tag} ${styles.tagFailed}`}>
        Bounced
      </span>,
    );
  }
  return chips;
}

// ── Timeline row ─────────────────────────────────────────────────────────────

function TimelineRow({ activity }: { activity: LeadActivity }) {
  const time = formatTime(activity.createdAt);

  if (activity.type === "stage_change") {
    return (
      <div className={styles.tlRow}>
        <div className={`${styles.tlIcon} ${styles.tlIconStage}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className={styles.tlBody}>
          <div className={styles.tlTop}>
            <span className={styles.tlLabel}>Stage changed</span>
            <span className={styles.tlTime}>{time}</span>
          </div>
          <span className={styles.tlDetail}>{activity.body}</span>
        </div>
      </div>
    );
  }

  if (activity.type === "email") {
    return (
      <div className={styles.tlRow}>
        <div className={`${styles.tlIcon} ${styles.tlIconEmail}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6h18v12H3zM3 7l9 6 9-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className={styles.tlBody}>
          <div className={styles.tlTop}>
            <span className={styles.tlLabel}>Email sent</span>
            <span className={styles.tlTime}>{time}</span>
          </div>
          <span className={styles.tlDetail}>{activity.subject}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tlRow}>
      <div className={`${styles.tlIcon} ${styles.tlIconNote}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className={styles.tlBody}>
        <div className={styles.tlTop}>
          <span className={styles.tlLabel}>Note added</span>
          <span className={styles.tlTime}>{time}</span>
        </div>
        <span className={styles.tlDetail}>{activity.body}</span>
      </div>
    </div>
  );
}
