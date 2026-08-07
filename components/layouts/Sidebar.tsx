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
  { icon: "/icons/menu/home.svg", href: "/dashboard", label: "Home" },
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
  // { icon: "/icons/menu/sales.svg", href: "/sales", label: "Sales" },
  // { icon: "/icons/menu/inventory.svg", href: "/inventory", label: "Inventory" },
  // {
  //   icon: "/icons/menu/marketplace.svg",
  //   href: "/marketplace",
  //   label: "Marketplace",
  // },
  // { icon: "/icons/menu/players.svg", href: "/players", label: "Players" },
  // { icon: "/icons/menu/settings.svg", href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  const getIconPath = (iconPath: string, active: boolean) => {
    if (active) {
      return iconPath.replace(".svg", "-filled.svg");
    }
    return iconPath;
  };

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.navItems}>
        {sidebarItems.map((item) => {
          const itemIsActive = isActive(item.href);
          const isHovered = hoveredItem === item.href;

          return (
            <div
              key={item.href}
              className={`${styles.navItemWrapper} ${itemIsActive ? styles.activeWrapper : ""}`}
            >
              <Link
                href={item.href}
                className={`${styles.navItem} ${itemIsActive ? styles.active : ""} ${isHovered ? styles.hovered : ""}`}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className={styles.iconContainer}>
                  {item.svgIcon ? (
                    <span
                      style={{
                        color: itemIsActive ? "#111827" : "#6b7280",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                      }}
                    >
                      {item.svgIcon}
                    </span>
                  ) : item.icon ? (
                    <Image
                      src={getIconPath(item.icon, itemIsActive)}
                      alt={item.label}
                      width={28}
                      height={28}
                      className={`${styles.icon} ${itemIsActive ? styles.iconActive : ""}`}
                    />
                  ) : null}
                </div>
              </Link>

              {/* Tooltip */}
              {isHovered && <div className={styles.tooltip}>{item.label}</div>}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
