"use client";

import { ReactNode } from "react";
import Image from "next/image";
import ActionHeader from "./headers/ActionHeader";
import styles from "./AuthLayout.module.css";

interface AuthLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  onBackClick?: () => void;
  heroImage?: string;
  heroAlt?: string;
  backgroundColor?: string;
}

export default function AuthLayout({
  children,
  showBackButton = true,
  onBackClick,
  heroImage = "/images/login/auth-bg.png",
  heroAlt = "Bord Business",
  backgroundColor = "var(--bg-standard)",
}: AuthLayoutProps) {
  return (
    <div className={styles.container} style={{ backgroundColor }}>
      {/* Split Content */}
      <div className={styles.content}>
        {/* Left Section - Form */}
        <div className={styles.leftSection}>
          {/* Action Header - only on left side */}
          {showBackButton && (
            <ActionHeader
              type="back"
              secondaryAction={onBackClick}
              constrained={false}
            />
          )}
          <div className={styles.formContainer}>{children}</div>
        </div>

        {/* Right Section - Hero Image */}
        <div className={styles.rightSection}>
          <div className={styles.heroContainer}>
            <Image
              src={heroImage}
              alt={heroAlt}
              fill
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
