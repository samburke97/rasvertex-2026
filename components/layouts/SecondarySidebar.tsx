"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./SecondarySidebar.module.css";

interface SubNavItem {
  href: string;
  label: string;
}

interface SecondarySidebarProps {
  title: string;
  items: SubNavItem[];
  basePath: string;
}

export default function SecondarySidebar({
  title,
  items,
  basePath,
}: SecondarySidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const isActive = (href: string) => {
    if (href === basePath) {
      return pathname === basePath;
    }
    return pathname === href;
  };

  const handleToggleCollapse = () => {
    if (!isCollapsed) {
      // When closing, add closing animation class
      setIsAnimating(true);

      // Wait for animation to complete before actually collapsing
      setTimeout(() => {
        setIsCollapsed(true);
        setIsAnimating(false);
      }, 300);
    } else {
      // When opening, just toggle immediately (slide-in animation handled by CSS)
      setIsCollapsed(false);
    }
  };

  if (isCollapsed) {
    // Collapsed state - show open icon outside the sidebar container
    return (
      <div className={styles.collapsedContainer}>
        <button
          className={styles.openButton}
          onClick={handleToggleCollapse}
          aria-label="Expand sidebar"
        >
          <Image
            src="/icons/utility-outline/open.svg"
            alt="Expand"
            width={16}
            height={16}
          />
        </button>
      </div>
    );
  }

  return (
    <aside
      className={`${styles.secondarySidebar} ${isAnimating ? styles.animating : ""}`}
    >
      {/* Header with title and collapse button */}
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button
          className={styles.collapseButton}
          onClick={handleToggleCollapse}
          aria-label="Collapse sidebar"
        >
          <Image
            src="/icons/utility-outline/collapse.svg"
            alt="Collapse"
            width={16}
            height={16}
          />
        </button>
      </div>

      {/* Navigation items */}
      <nav className={styles.navItems}>
        {items.map((item) => {
          const itemIsActive = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${itemIsActive ? styles.active : ""}`}
            >
              <span className={styles.navLabel}>{item.label}</span>
              <Image
                src="/icons/utility-outline/right.svg"
                alt="Navigate"
                width={16}
                height={16}
                className={styles.chevron}
              />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
