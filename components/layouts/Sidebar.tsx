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
    href: "/recertifications",
    label: "Recertifications",
    svgIcon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
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

  const getIconPath = (iconPath: string, active: boolean) => {
    if (active) {
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
