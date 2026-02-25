// app/(list)/marketplace/page.tsx - DYNAMIC VERSION
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import SecondarySidebar from "@/components/layouts/SecondarySidebar";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import LocationDetailPage from "@/components/marketplace/details/LocationDetailPage";
import styles from "./page.module.css";

// Define the sub-navigation items for marketplace
const marketplaceNavItems = [
  { href: "/marketplace", label: "Overview" },
  { href: "/marketplace/details", label: "Details" },
  { href: "/marketplace/location", label: "Location" },
  { href: "/marketplace/gallery", label: "Gallery" },
  { href: "/marketplace/about", label: "About" },
  { href: "/marketplace/opening-times", label: "Opening Times" },
  { href: "/marketplace/facilities", label: "Facilities" },
  { href: "/marketplace/contact", label: "Contact & Links" },
];

export default function MarketplacePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup completion state
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  const [centerId, setCenterId] = useState<string | null>(null);

  // Check if user has completed marketplace setup
  const checkSetupStatus = async () => {
    if (!session?.user?.id) return;

    try {
      setIsInitialLoading(true);
      setError(null);

      console.log("🔍 Checking marketplace setup status...");

      // Get user's business status and centers
      const response = await fetch("/api/user/business-status", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to get business information");
      }

      const data = await response.json();
      console.log("📊 Business status response:", data);

      // If user needs business setup, they haven't completed marketplace setup
      if (data.needsSetup || !data.business) {
        setHasCompletedSetup(false);
        return;
      }

      console.log("✅ User has business:", data.business.name);
      console.log("🏢 Centers found:", data.business.centers?.length || 0);

      // Check if business has centers
      if (data.business.centers && data.business.centers.length > 0) {
        const centerInfo = data.business.centers[0];
        console.log("🎯 Found center:", centerInfo);
        setCenterId(centerInfo.id);

        // If we have a center, consider setup complete for now
        // (we can add more validation later if needed)
        setHasCompletedSetup(true);
      } else {
        setHasCompletedSetup(false);
      }
    } catch (error) {
      setHasCompletedSetup(false);
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Check setup status on mount
  useEffect(() => {
    if (status === "authenticated") {
      checkSetupStatus();
    }
  }, [status, session?.user?.id]);

  // Handle starting marketplace setup
  const handleStartNow = async () => {
    try {
      setIsActionLoading(true);

      // Check if user needs business setup first
      const response = await fetch("/api/user/business-status", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📊 Business status for marketplace:", data);

        // If user needs business setup, redirect there first
        if (data.needsSetup) {
          console.log(
            "🔄 User needs business setup, redirecting to onboarding"
          );
          router.push("/business/onboarding");
          return;
        }
      }

      // Always go to marketplace setup - let the setup flow handle existing centers
      console.log("🚀 Starting marketplace setup flow");
      router.push("/marketplace/setup");
    } catch (error) {
      console.error("❌ Error checking business status:", error);
      // Fallback to setup flow anyway
      router.push("/marketplace/setup");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLearnMore = () => {
    router.push("/about");
  };

  // Loading state
  if (status === "loading" || isInitialLoading) {
    return (
      <>
        <SecondarySidebar
          title="Online Profile"
          items={marketplaceNavItems}
          basePath="/marketplace"
        />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "50vh",
          }}
        >
          <LoadingSpinner />
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <SecondarySidebar
          title="Online Profile"
          items={marketplaceNavItems}
          basePath="/marketplace"
        />
        <div className={styles.container}>
          <div className={styles.content}>
            <h2>Error loading marketplace</h2>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </div>
      </>
    );
  }

  console.log(
    "🎨 Rendering marketplace page. Setup complete:",
    hasCompletedSetup,
    "Center ID:",
    centerId
  );

  return (
    <>
      <SecondarySidebar
        title="Online Profile"
        items={marketplaceNavItems}
        basePath="/marketplace"
      />

      {/* If setup is complete, show location detail page */}
      {hasCompletedSetup && centerId ? (
        <LocationDetailPage params={{ id: centerId }} />
      ) : (
        /* If setup is not complete, show "Go live" page */
        <div className={styles.container}>
          {/* Background Art Layers */}
          <div className={styles.backgroundArt}>
            <img
              src="/images/backgrounds/dots.svg"
              className={styles.dotsPattern}
              alt=""
            />
            <img
              src="/images/backgrounds/lines.svg"
              className={styles.linesPattern}
              alt=""
            />
          </div>

          {/* Main Content */}
          <div className={styles.content}>
            {/* Main Heading */}
            <h1 className={styles.title}>
              Go live on the bord
              <br />
              marketplace today
            </h1>

            {/* Subtitle */}
            <p className={styles.description}>
              Finish setting up your business to create a listing on the
              marketplace.
            </p>

            {/* Action Buttons */}
            <div className={styles.buttonContainer}>
              <Button
                variant="primary-green"
                onClick={handleStartNow}
                className={styles.primaryButton}
                disabled={isActionLoading}
              >
                {isActionLoading ? "Loading..." : "Start Now"}
              </Button>

              <Button
                variant="secondary"
                onClick={handleLearnMore}
                className={styles.secondaryButton}
                disabled={isActionLoading}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
