"use client";
// TopNavbar.tsx — the page card's 56px top bar: breadcrumb left; search,
// alerts, theme and the user right. Nothing else (style guide).

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./Sidebar";
import { LINE, isLineKey } from "@/lib/caro/data";
import styles from "./TopNavbar.module.css";
import { useTopNav, type Crumb } from "./topNavSlot";

interface TopNavbarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

// Caro routes by hash (#sites/hs, #automations/new, …).
const CARO_VIEWS: Record<string, string> = {
  overview: "Overview",
  sites: "All sites",
  clients: "Clients",
  automations: "Automations",
  templates: "Email templates",
  timing: "Reminder timing",
};
function caroCrumbs(hash: string): Crumb[] {
  const [view, sub] = (hash.slice(1) || "overview").split("/");
  const c: Crumb[] = [
    { label: "Caro", href: "/caro#overview" },
    { label: CARO_VIEWS[view] ?? "Overview", href: `/caro#${view || "overview"}` },
  ];
  if (view === "sites" && isLineKey(sub)) c[1] = { label: LINE[sub].name, href: `/caro#sites/${sub}` };
  if (view === "automations" && sub) c.push({ label: sub === "library" ? "Library" : sub === "new" ? "New automation" : "Edit automation" });
  return c;
}

/** The section's own steps; every one links back to its page. */
function crumbsFor(pathname: string | null, hash: string): Crumb[] {
  if (!pathname || pathname === "/") return [{ label: "Today", href: "/" }];
  if (pathname.startsWith("/caro")) return caroCrumbs(hash);
  if (pathname.startsWith("/workspace")) return [{ label: "CRM", href: "/crm" }, { label: "Workspace" }];
  const item = NAV_ITEMS.find((n) => pathname.startsWith(n.href));
  // Reports: the section's start is its report picker (#new).
  if (item?.href === "/reports") return [{ label: item.label, href: "/reports#new" }];
  return item ? [{ label: item.label, href: item.href }] : [];
}

/** Following a link to the hash already showing still takes you back to
 *  that page's start (e.g. Reports from inside a builder). */
function go(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  const url = new URL(href, window.location.href);
  if (url.pathname === window.location.pathname && url.hash === window.location.hash) {
    e.preventDefault();
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

export default function TopNavbar({ theme, onToggleTheme }: TopNavbarProps) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [pathname]);
  // A page can add its own steps and a status (see topNavSlot).
  const extra = useTopNav();
  const crumbs = [...crumbsFor(pathname, hash), ...(extra.crumbs ?? [])];

  return (
    <header className={styles.topNav}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={`${i}-${c.label}`} className={styles.crumbWrap}>
            {i > 0 && (
              <svg className={styles.crumbSep} viewBox="0 0 24 24" fill="none">
                <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {c.href && i < crumbs.length - 1 ? (
              <a className={`${styles.crumb} ${styles.crumbLink}`} href={c.href} onClick={(e) => go(e, c.href!)}>
                {c.label}
              </a>
            ) : (
              <span className={styles.crumb} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className={styles.right}>
        {extra.status && <div className={styles.status}>{extra.status}</div>}
        <button
          type="button"
          className={styles.searchTrigger}
          onClick={() => {
            // TODO: global search
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M20.5 11a9.5 9.5 0 11-19 0 9.5 9.5 0 0119 0zM22 22l-3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Search</span>
          <span className={styles.kbd}>⌘K</span>
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={onToggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M20.5 14.3A8.5 8.5 0 019.7 3.5A8.5 8.5 0 1020.5 14.3Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={styles.iconButton}
          aria-label="Notifications"
          title="Notifications"
          onClick={() => {
            // TODO: notifications panel
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 8.5a6 6 0 10-12 0c0 6.5-2.5 8-2.5 8h17S18 15 18 8.5zM13.7 20a2 2 0 01-3.4 0"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

      </div>
    </header>
  );
}
