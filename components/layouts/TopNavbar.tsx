"use client";

import Image from "next/image";
import styles from "./TopNavbar.module.css";

interface TopNavbarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export default function TopNavbar({ theme, onToggleTheme }: TopNavbarProps) {
  const getProfileInitials = () => "U"; // Ultimate fallback — no auth session wired up yet
  const getProfileImage = (): string | null => null; // OAuth profile image, once wired up

  const handleNotificationsClick = () => {
    // TODO: Implement notifications panel
    console.log("Notifications clicked");
  };

  const handleSearchClick = () => {
    // TODO: Implement search functionality
    console.log("Search clicked");
  };

  const handleProfileClick = () => {
    // Sign out when profile is clicked
    // signOut({ callbackUrl: "/login" });
  };

  return (
    <header className={styles.topNav}>
      <button
        className={styles.iconButton}
        onClick={onToggleTheme}
        aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      >
        {theme === "light" ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 12.8a9 9 0 11-9.8-9.8 7 7 0 009.8 9.8z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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
        className={styles.iconButton}
        onClick={handleSearchClick}
        aria-label="Search"
      >
        <Image
          src="/icons/utility-outline/search.svg"
          alt=""
          width={16}
          height={16}
        />
      </button>

      <button
        className={styles.iconButton}
        onClick={handleNotificationsClick}
        aria-label="Notifications"
      >
        <Image
          src="/icons/utility-outline/notification.svg"
          alt=""
          width={16}
          height={16}
        />
      </button>

      <button
        className={styles.profileBadge}
        onClick={handleProfileClick}
        aria-label="Profile menu"
      >
        {getProfileImage() ? (
          <Image
            src={getProfileImage()!}
            alt="Profile"
            width={28}
            height={28}
            className={styles.profileImage}
          />
        ) : (
          <span className={styles.profileInitials}>{getProfileInitials()}</span>
        )}
      </button>
    </header>
  );
}
