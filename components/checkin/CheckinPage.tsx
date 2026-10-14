"use client";
// components/checkin/CheckinPage.tsx
//
// Client Check-in (/checkin): every SimPRO client in one table. Click a
// client to see their history and the recommended follow-up angle, with a
// ready-made email to copy. Read-only — data comes from the last sync
// (lib/checkin), nothing is sent from here.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./CheckinPage.module.css";
import { CHECKIN_CONFIG, type AngleId } from "@/lib/checkin/config";
import type { CheckinClient } from "@/lib/checkin/analyse";
import type { CheckinRow } from "@/lib/checkin/store";
import { composeEmail, pickAngle } from "@/lib/checkin/email";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import CountBadge from "@/components/ui/CountBadge";
import SearchInput from "@/components/ui/SearchInput";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import DataTable, { type Column } from "@/components/ui/DataTable";

type SortKey = "score" | "ltv" | "recent" | "oldest" | "name";

const ANGLE_LABEL = Object.fromEntries(
  Object.entries(CHECKIN_CONFIG.angles).map(([id, a]) => [id, a.label]),
) as Record<AngleId, string>;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

function formatSynced(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Brisbane",
  });
}

// ── Client modal ──────────────────────────────────────────────────────────

function ClientModal({ row, onClose, onCopied }: { row: CheckinRow; onClose: () => void; onCopied: (msg: string) => void }) {
  const [client, setClient] = useState<CheckinClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [angleId, setAngleId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/checkin/${row.id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load client");
        if (!cancelled) setClient(data.client);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load client"));
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  // Regenerate the email whenever the client loads or the angle changes.
  useEffect(() => {
    if (!client) return;
    const email = composeEmail(client, pickAngle(client, angleId));
    setSubject(email.subject);
    setBody(email.body);
  }, [client, angleId]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied(`${what} copied`);
    } catch {
      alert("Couldn't copy. Select the text and copy it manually.");
    }
  };

  const chosen = client ? pickAngle(client, angleId) : undefined;
  const blockers = client?.angles.filter((a) => a.blocker) ?? [];
  const options = client ? [...client.angles, ...client.alternatives].filter((a) => !a.blocker) : [];

  return (
    <Modal isOpen onClose={onClose} title={row.name}>
      {error ? (
        <div className={styles.error}>{error}</div>
      ) : !client ? (
        <div className={styles.loadingState}>
          <LoadingSpinner />
        </div>
      ) : (
        <div className={styles.detail}>
          <p className={styles.summary}>{client.summary}</p>

          {blockers.map((a) => (
            <div key={a.id} className={styles.bannerRed}>
              {a.title}
            </div>
          ))}
          {!client.email && (
            <div className={styles.bannerAmber}>No email on file{client.phone ? `. Call ${client.phone}` : ""}.</div>
          )}
          {client.sharedWith.length > 0 && (
            <div className={styles.bannerAmber}>
              This email also covers {client.sharedWith.join(", ")}. Consider one email for all of them.
            </div>
          )}
          {client.inProgress.length > 0 && (
            <div className={styles.bannerAmber}>In progress: {client.inProgress.join("; ")}</div>
          )}

          {/* Follow-up angle */}
          <section>
            <h3 className={styles.sectionTitle}>Follow-up angle</h3>
            <div className={styles.angles}>
              {options.map((a) => (
                <label key={a.id} className={`${styles.angle} ${chosen?.id === a.id ? styles.angleActive : ""}`}>
                  <input
                    type="radio"
                    name="angle"
                    checked={chosen?.id === a.id}
                    onChange={() => setAngleId(a.id)}
                  />
                  <span className={styles.stack}>
                    <span className={styles.angleTitle}>{a.title}</span>
                    <span className={styles.tdMuted}>{a.reason}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* Email */}
          <section>
            <h3 className={styles.sectionTitle}>
              Email {client.email ? `to ${client.contactName ? `${client.contactName} · ` : ""}${client.email}` : ""}
            </h3>
            <input className={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
            <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Email body" />
            <div className={styles.emailActions}>
              <span className={styles.hint}>Edit freely. Nothing is sent from here.</span>
              <Button variant="secondary" size="sm" onClick={() => copy(subject, "Subject")}>
                Copy subject
              </Button>
              <Button variant="brand" size="sm" onClick={() => copy(body, "Email")}>
                Copy email
              </Button>
            </div>
          </section>

          {/* Client facts */}
          <section>
            <h3 className={styles.sectionTitle}>Client</h3>
            <div className={styles.facts}>
              <Fact label="Contact" value={client.contactName || "—"} sub={client.email || "No email"} />
              <Fact label="Phone" value={client.phone || "—"} />
              <Fact label="Sites" value={String(client.siteCount)} sub={[client.site, client.suburb].filter(Boolean).join(", ")} />
              <Fact label="Jobs" value={`${client.jobCount} · ${formatCurrency(client.ltv)}`} sub="lifetime, ex GST" />
              <Fact
                label="First / last job"
                value={client.firstJob ? `${formatDate(client.firstJob)} → ${formatDate(client.lastJob?.date)}` : "—"}
                sub={client.monthsSince != null ? `${client.monthsSince} months ago` : undefined}
              />
              <Fact label="Cost centres" value={client.costCentres.join(", ") || "—"} />
            </div>
            {client.otherContacts.length > 0 && (
              <details className={styles.more}>
                <summary>Other contacts ({client.otherContacts.length})</summary>
                <div className={styles.tdMuted}>
                  {client.otherContacts.map((c) => (
                    <div key={c}>{c}</div>
                  ))}
                </div>
              </details>
            )}
          </section>

          {client.unpaid.length > 0 && (
            <section>
              <h3 className={styles.sectionTitle}>Unpaid invoices</h3>
              <table className={styles.mini}>
                <tbody>
                  {client.unpaid.map((i) => (
                    <tr key={i.id}>
                      <td>#{i.id}</td>
                      <td className={styles.tdMuted}>
                        Issued {formatDate(i.issued)} · due {formatDate(i.due)}
                      </td>
                      <td>{i.overdue && <CountBadge variant="warning" label="Overdue" />}</td>
                      <td className={styles.num}>{formatCurrency(i.owing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {client.openQuotes.length > 0 && (
            <section>
              <h3 className={styles.sectionTitle}>Open quotes</h3>
              <table className={styles.mini}>
                <tbody>
                  {client.openQuotes.map((q) => (
                    <tr key={q.id}>
                      <td>#{q.id}</td>
                      <td>
                        <div className={styles.stack}>
                          <span>{q.name}</span>
                          <span className={styles.tdMuted}>
                            {q.status} · {formatDate(q.issued)} · {q.age} days
                          </span>
                        </div>
                      </td>
                      <td className={styles.num}>{formatCurrency(q.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h3 className={styles.sectionTitle}>Job history ({client.jobs.length})</h3>
            {client.jobs.length === 0 ? (
              <div className={styles.tdMuted}>No jobs on record.</div>
            ) : (
              <table className={styles.mini}>
                <tbody>
                  {client.jobs.map((j) => (
                    <tr
                      key={j.id}
                      className={j.unconfirmed ? styles.unconfirmed : undefined}
                      title={j.unconfirmed ? "ServiceM8 import that never reached Fully-paid: likely a lost quote or unfinished work. Not counted." : undefined}
                    >
                      <td className={styles.nowrap}>
                        {j.active ? <CountBadge variant="success" label="In progress" /> : formatDate(j.date)}
                        {j.unconfirmed && <div className={styles.tdMuted}>SM8 unconfirmed</div>}
                      </td>
                      <td>
                        <div className={styles.stack}>
                          <span>{j.desc}</span>
                          <span className={styles.tdMuted}>
                            {[j.site, j.cc, j.status].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      </td>
                      <td className={styles.num}>{formatCurrency(j.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={styles.stack}>
      <span className={styles.factLabel}>{label}</span>
      <span>{value}</span>
      {sub ? <span className={styles.tdMuted}>{sub}</span> : null}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CheckinPage() {
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [angle, setAngle] = useState<AngleId | "">("");
  const [costCentre, setCostCentre] = useState("");
  const [hasEmail, setHasEmail] = useState<"" | "yes" | "no">("");
  const [sort, setSort] = useState<SortKey>("score");
  const [open, setOpen] = useState<CheckinRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load clients");
      setRows(data.rows);
      setSyncedAt(data.syncedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/checkin/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setToast(`Refreshed ${data.clients.toLocaleString("en-AU")} clients from SimPRO`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setSyncing(false);
    }
  };

  const angleCounts = useMemo(() => {
    const m = new Map<AngleId, number>();
    for (const r of rows) for (const id of r.angleIds) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const costCentres = useMemo(() => [...new Set(rows.flatMap((r) => r.costCentres))].sort(), [rows]);

  const stats = useMemo(() => {
    const withEmail = rows.filter((r) => r.email).length;
    return {
      clients: rows.length,
      withEmail,
      ltv: rows.reduce((s, r) => s + r.ltv, 0),
      recent: rows.filter((r) => r.monthsSince != null && r.monthsSince < 24).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows.filter((r) => {
      if (angle && !r.angleIds.includes(angle)) return false;
      if (costCentre && !r.costCentres.includes(costCentre)) return false;
      if (hasEmail && (hasEmail === "yes") !== !!r.email) return false;
      if (!words.length) return true;
      const hay = `${r.name} ${r.contactName} ${r.email} ${r.site} ${r.suburb} ${r.lastJobDesc ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const by: Record<SortKey, (a: CheckinRow, b: CheckinRow) => number> = {
      score: (a, b) => b.score - a.score,
      ltv: (a, b) => b.ltv - a.ltv,
      recent: (a, b) => (b.lastJobDate ?? "").localeCompare(a.lastJobDate ?? ""),
      oldest: (a, b) => (a.lastJobDate ?? "9999").localeCompare(b.lastJobDate ?? "9999"),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [rows, search, angle, costCentre, hasEmail, sort]);

  const columns: Column<CheckinRow>[] = [
    {
      key: "name",
      header: "Client",
      render: (r) => (
        <div className={styles.stack}>
          <span className={styles.clientName}>{r.name}</span>
          <span className={styles.tdMuted}>
            {r.type}
            {r.suburb ? ` · ${r.suburb}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (r) =>
        r.email ? (
          <div className={styles.stack}>
            <span>{r.contactName || "—"}</span>
            <span className={styles.tdMuted}>{r.email}</span>
          </div>
        ) : (
          <span className={styles.warn}>No email</span>
        ),
    },
    {
      key: "last",
      header: "Last job",
      render: (r) =>
        r.lastJobDate ? (
          <div className={styles.stack}>
            <span>{r.lastJobDesc}</span>
            <span className={styles.tdMuted}>
              {formatDate(r.lastJobDate)} · {r.monthsSince} mo ago
            </span>
          </div>
        ) : (
          <span className={styles.tdMuted}>No completed jobs</span>
        ),
    },
    {
      key: "ltv",
      header: "Lifetime",
      align: "right",
      render: (r) => (
        <div className={styles.stack}>
          <span>{formatCurrency(r.ltv)}</span>
          <span className={styles.tdMuted}>
            {r.jobCount} job{r.jobCount === 1 ? "" : "s"}
          </span>
        </div>
      ),
    },
    {
      key: "angle",
      header: "Follow-up angle",
      render: (r) => (
        <div className={styles.stack}>
          {r.blockers.length > 0 && (
            <span className={styles.inline}>
              {r.blockers.map((b) => (
                <CountBadge key={b} variant="warning" label={b} />
              ))}
            </span>
          )}
          <span>{r.leadTitle}</span>
        </div>
      ),
    },
    {
      key: "score",
      header: "Priority",
      align: "right",
      render: (r) => <span className={styles.score}>{r.score}</span>,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Client Check-in</h1>
          <p className={styles.subtitle}>
            Every SimPRO client and the best reason to get in touch. Click a client for their history and a ready-made
            email. Nothing is sent from here.
          </p>
        </div>
        <div className={styles.headerRight}>
          {syncedAt && <span className={styles.syncedAt}>Synced {formatSynced(syncedAt)}</span>}
          <Button variant="secondary" size="sm" onClick={sync} disabled={syncing || loading}>
            {syncing ? "Refreshing… (~2 min)" : "↺ Refresh from SimPRO"}
          </Button>
          <a className={styles.link} href="/api/checkin/export">
            Download CSV
          </a>
        </div>
      </div>

      <div className={styles.cards}>
        <Card padding="md" className={styles.card}>
          <span className={styles.cardCount}>{stats.clients.toLocaleString("en-AU")}</span>
          <span className={styles.cardLabel}>Clients</span>
        </Card>
        <Card padding="md" className={styles.card}>
          <span className={styles.cardCount}>{stats.withEmail.toLocaleString("en-AU")}</span>
          <span className={styles.cardLabel}>
            With an email{stats.clients ? ` · ${Math.round((100 * stats.withEmail) / stats.clients)}%` : ""}
          </span>
        </Card>
        <Card padding="md" className={styles.card}>
          <span className={styles.cardCount}>{formatCurrency(stats.ltv)}</span>
          <span className={styles.cardLabel}>Lifetime value, ex GST</span>
        </Card>
        <Card padding="md" className={styles.card}>
          <span className={styles.cardCount}>{stats.recent.toLocaleString("en-AU")}</span>
          <span className={styles.cardLabel}>Worked with in last 24 months</span>
        </Card>
      </div>

      <div className={styles.filters}>
        <SearchInput
          placeholder="Search client, contact, email, site or suburb..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          className={styles.searchWrap}
        />
        <select className={styles.select} value={angle} onChange={(e) => setAngle(e.target.value as AngleId | "")} aria-label="Follow-up angle">
          <option value="">All angles</option>
          {angleCounts.map(([id, n]) => (
            <option key={id} value={id}>
              {ANGLE_LABEL[id]} ({n})
            </option>
          ))}
        </select>
        <select className={styles.select} value={costCentre} onChange={(e) => setCostCentre(e.target.value)} aria-label="Cost centre">
          <option value="">All cost centres</option>
          {costCentres.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className={styles.select} value={hasEmail} onChange={(e) => setHasEmail(e.target.value as "" | "yes" | "no")} aria-label="Email">
          <option value="">Any email</option>
          <option value="yes">Has email</option>
          <option value="no">No email</option>
        </select>
        <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="score">Sort: priority</option>
          <option value="ltv">Sort: lifetime value</option>
          <option value="recent">Sort: last job, newest</option>
          <option value="oldest">Sort: last job, oldest</option>
          <option value="name">Sort: name</option>
        </select>
        <span className={styles.syncedAt}>{filtered.length.toLocaleString("en-AU")} shown</span>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          {error}
          <Button variant="secondary" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : !rows.length ? (
        <div className={styles.emptyState}>
          No clients yet. Click &ldquo;Refresh from SimPRO&rdquo; to load them (takes about 2 minutes).
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          onRowClick={setOpen}
          emptyMessage={search ? `No results for "${search}"` : "No clients match these filters."}
          itemsPerPage={25}
        />
      )}

      {open && <ClientModal row={open} onClose={() => setOpen(null)} onCopied={setToast} />}
      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}
