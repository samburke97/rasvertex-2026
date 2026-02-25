// MainLayout.tsx - Modern CSS Grid Version
"use client";

import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import styles from "./MainLayout.module.css";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className={styles.layout}>
      <TopNavbar />
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
