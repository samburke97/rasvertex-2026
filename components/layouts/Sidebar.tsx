"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./Sidebar.module.css";

interface SidebarItem {
  href: string;
  label: string;
  svgIcon: React.ReactNode;
}

// Icons are inline 24px strokes in currentColor, so they follow hover,
// active and dark mode (style guide rail).
export const NAV_ITEMS: SidebarItem[] = [
  {
    href: "/dashboard",
    label: "Today",
    svgIcon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path d="M3 10.5L12 3L21 10.5M5.5 9V19.5C5.5 20.05 5.95 20.5 6.5 20.5H9.5C10.05 20.5 10.5 20.05 10.5 19.5V15.5C10.5 14.95 10.95 14.5 11.5 14.5H12.5C13.05 14.5 13.5 14.95 13.5 15.5V19.5C13.5 20.05 13.95 20.5 14.5 20.5H17.5C18.05 20.5 18.5 20.05 18.5 19.5V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    svgIcon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path d="M7 3h10a1 1 0 011 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 011-1zM9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/recurring-jobs",
    label: "Recurring jobs",
    svgIcon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path d="M20 12A8 8 0 1 1 17.66 6.34M20 3.5V8H15.5M12 8V12L14.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/outreach",
    label: "Outreach",
    svgIcon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path d="M20.5 3.5 10.75 13.25M20.5 3.5l-6.25 17-3.5-7.25L3.5 9.75l17-6.25Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/checkin",
    label: "Client check-in",
    svgIcon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path d="M8 4.5H6A1.5 1.5 0 0 0 4.5 6v13A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 18 4.5h-2M8 4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5 1.5 1.5 0 0 1 14.5 6h-5A1.5 1.5 0 0 1 8 4.5ZM8.5 13l2.25 2.25L15.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/crm",
    label: "CRM",
    svgIcon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2.1.7 3.5 2.6 3.5 5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
        {NAV_ITEMS.map((item) => {
          const itemIsActive = isActive(item.href);
          const isHovered = hoveredItem === item.href;

          return (
            <div key={item.href} className={styles.navItemWrapper}>
              <Link
                href={item.href}
                className={`${styles.navItem} ${itemIsActive ? styles.active : ""} ${isHovered ? styles.hovered : ""}`}
                aria-label={item.label}
                aria-current={itemIsActive ? "page" : undefined}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className={styles.iconContainer}>
                  {item.svgIcon}
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
