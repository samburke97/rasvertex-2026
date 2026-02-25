"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import styles from "./TopNavbar.module.css";

export default function TopNavbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const getPageTitle = () => {
    const path = pathname?.split("/").pop();
    if (!path || path === "dashboard") return "Dashboard";
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const getProfileInitials = () => {
    const firstName = session?.user?.firstName;
    const lastName = session?.user?.lastName;

    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }

    // Fallback to email if no first/last name
    if (session?.user?.email) {
      return session.user.email.charAt(0).toUpperCase();
    }

    return "U"; // Ultimate fallback
  };

  const getProfileImage = () => {
    // OAuth profile image
    if (session?.user?.image) {
      return session.user.image;
    }

    return null;
  };

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
    signOut({ callbackUrl: "/login" });
  };

  return (
    <header className={styles.topNav}>
      {/* Left section - Bord Logo */}
      <div className={styles.leftSection}>
        <div className={styles.logoContainer}>RAS-VERTEX</div>
      </div>

      {/* Right section - Search, Notifications, Profile */}
      <div className={styles.rightSection}>
        {/* Search Icon */}
        <button
          className={styles.iconButton}
          onClick={handleSearchClick}
          aria-label="Search"
        >
          <Image
            src="/icons/utility-outline/search.svg"
            alt="Search"
            width={24}
            height={24}
            className={styles.icon}
          />
        </button>

        {/* Notifications Icon */}
        <button
          className={styles.iconButton}
          onClick={handleNotificationsClick}
          aria-label="Notifications"
        >
          <Image
            src="/icons/utility-outline/notification.svg"
            alt="Notifications"
            width={24}
            height={24}
            className={styles.icon}
          />
        </button>

        {/* Profile Badge */}
        <button
          className={styles.profileBadge}
          onClick={handleProfileClick}
          aria-label="Profile menu"
        >
          {getProfileImage() ? (
            <Image
              src={getProfileImage()!}
              alt="Profile"
              width={32}
              height={32}
              className={styles.profileImage}
            />
          ) : (
            <span className={styles.profileInitials}>
              {getProfileInitials()}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
