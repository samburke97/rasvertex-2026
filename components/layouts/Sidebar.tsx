"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./Sidebar.module.css";

interface SidebarItem {
  icon?: string;
  href: string;
  label: string;
  svgIcon?: React.ReactNode;
}

const sidebarItems: SidebarItem[] = [
  { icon: "/icons/menu/home.svg", href: "/dashboard", label: "Dashboard" },
  { icon: "/icons/menu/reports.svg", href: "/reports", label: "Reports" },
  {
    icon: "/icons/menu/calendar.svg",
    href: "/recurring-jobs",
    label: "Recurring Jobs",
  },
  {
    href: "/crm",
    label: "CRM",
    // Inline — no /icons/menu/crm.svg asset exists yet, and svgIcon avoids
    // needing one (or a -filled variant) just for this one nav entry.
    svgIcon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M3.5 19c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M15.5 4.14a3.25 3.25 0 0 1 0 6.22M17.5 19c0-2.485-1.53-4.61-3.7-5.31"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

interface SidebarProps {
  showWorkspaceToggle: boolean;
  workspaceCollapsed: boolean;
  onToggleWorkspace: () => void;
}

export default function Sidebar({
  showWorkspaceToggle,
  workspaceCollapsed,
  onToggleWorkspace,
}: SidebarProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  const getProfileInitials = () => "U"; // Ultimate fallback — no auth session wired up yet
  const getProfileImage = (): string | null => null; // OAuth profile image, once wired up

  return (
    <aside className={styles.rail}>
      <div className={styles.logo} title="RAS-VERTEX">
        <span>RV</span>
        {showWorkspaceToggle && (
          <button
            type="button"
            className={styles.collapseBadge}
            onClick={onToggleWorkspace}
            aria-label={workspaceCollapsed ? "Expand workspace panel" : "Collapse workspace panel"}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              style={{ transform: workspaceCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}
            >
              <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <nav className={styles.navItems}>
        {sidebarItems.map((item) => {
          const itemIsActive = isActive(item.href);
          const isHovered = hoveredItem === item.href;

          return (
            <div key={item.href} className={styles.navItemWrapper}>
              <Link
                href={item.href}
                className={`${styles.navItem} ${itemIsActive ? styles.active : ""} ${isHovered ? styles.hovered : ""}`}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className={styles.iconContainer}>
                  {item.svgIcon ? (
                    item.svgIcon
                  ) : item.icon ? (
                    <Image
                      src={item.icon}
                      alt={item.label}
                      width={21}
                      height={21}
                      className={styles.icon}
                    />
                  ) : null}
                </div>
              </Link>

              {isHovered && <div className={styles.tooltip}>{item.label}</div>}
            </div>
          );
        })}
      </nav>

      <div className={styles.spacer} />

      <button className={styles.avatar} title="Account" type="button">
        {getProfileImage() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getProfileImage()!} alt="Profile" className={styles.avatarImage} />
        ) : (
          <span className={styles.avatarInitials}>{getProfileInitials()}</span>
        )}
      </button>
    </aside>
  );
}
