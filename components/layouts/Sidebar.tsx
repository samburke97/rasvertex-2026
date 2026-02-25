"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./Sidebar.module.css";

interface SidebarItem {
  icon: string;
  href: string;
  label: string;
  isActive?: boolean;
}

const sidebarItems: SidebarItem[] = [
  { icon: "/icons/menu/home.svg", href: "/dashboard", label: "Home" },
  { icon: "/icons/menu/reports.svg", href: "/reports", label: "Reports" },
  { icon: "/icons/menu/calendar.svg", href: "/calendar", label: "Calendar" },
  { icon: "/icons/menu/sales.svg", href: "/sales", label: "Sales" },
  { icon: "/icons/menu/inventory.svg", href: "/inventory", label: "Inventory" },
  {
    icon: "/icons/menu/marketplace.svg",
    href: "/marketplace",
    label: "Marketplace",
  },
  { icon: "/icons/menu/players.svg", href: "/players", label: "Players" },
  { icon: "/icons/menu/settings.svg", href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  const getIconPath = (iconPath: string, isActive: boolean) => {
    if (isActive) {
      // Replace .svg with -filled.svg
      return iconPath.replace(".svg", "-filled.svg");
    }
    return iconPath;
  };

  return (
    <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : ""}`}>
      <nav className={styles.navItems}>
        {sidebarItems.map((item) => {
          const itemIsActive = isActive(item.href);
          const isHovered = hoveredItem === item.href;

          return (
            <div key={item.href} className={styles.navItemWrapper}>
              <Link
                href={item.href}
                className={`${styles.navItem} ${
                  itemIsActive ? styles.active : ""
                } ${isHovered ? styles.hovered : ""}`}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className={styles.iconContainer}>
                  <Image
                    src={getIconPath(item.icon, itemIsActive)}
                    alt={item.label}
                    width={28}
                    height={28}
                    className={styles.icon}
                  />
                </div>
              </Link>

              {/* Tooltip for icon-only state */}
              {!isExpanded && isHovered && (
                <div className={styles.tooltip}>{item.label}</div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Expand/Collapse Toggle */}
      <button
        className={styles.toggleButton}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <div
          className={`${styles.toggleIcon} ${isExpanded ? styles.rotated : ""}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
    </aside>
  );
}
