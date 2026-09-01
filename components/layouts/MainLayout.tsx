// MainLayout.tsx — icon rail + floating card shell.
// Hosts the one global dark-mode toggle (surfaced in TopNavbar, so it's on
// every page) and the workspace tree, which stays scoped to the CRM/Leads
// section — it's a "Leads workspace" concept, not an app-wide one.
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import WorkspacePanel from "./WorkspacePanel";
import TopNavbar from "./TopNavbar";
import styles from "./MainLayout.module.css";

interface MainLayoutProps {
  children: React.ReactNode;
}

const THEME_KEY = "rv-theme";

export default function MainLayout({ children }: MainLayoutProps) {
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  // The root layout's blocking script already set the correct data-theme
  // attribute before first paint (reading the same localStorage key) — skip
  // the first write here so we don't clobber it back to "light" for the one
  // tick before this effect's localStorage read corrects the state.
  const skipNextWrite = useRef(true);
  const pathname = usePathname();
  const isWorkspaceSection =
    pathname?.startsWith("/crm") || pathname?.startsWith("/workspace");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark") setTheme("dark");
  }, []);

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <div className={styles.app}>
      <Sidebar
        showWorkspaceToggle={!!isWorkspaceSection}
        workspaceCollapsed={workspaceCollapsed}
        onToggleWorkspace={() => setWorkspaceCollapsed((c) => !c)}
      />
      {isWorkspaceSection && <WorkspacePanel collapsed={workspaceCollapsed} />}
      <div className={styles.mainWrap}>
        <div className={styles.panel}>
          <TopNavbar
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          />
          <main className={styles.main}>{children}</main>
        </div>
      </div>
    </div>
  );
}
