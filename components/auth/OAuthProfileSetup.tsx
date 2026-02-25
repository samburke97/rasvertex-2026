// components/auth/OAuthProfileSetup.tsx - DEDICATED OAuth Profile Setup
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import BusinessSetupForm from "./BusinessSetupForm";

export default function OAuthProfileSetup() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeOAuthFlow = async () => {
      if (status === "loading") {
        return;
      }

      // If no session, redirect to login
      if (!session?.user) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch("/api/user/profile-status", {
          credentials: "include",
        });

        if (response.ok) {
          const profileData = await response.json();

          // Check if profile is complete with ALL required fields
          if (
            profileData.isProfileComplete &&
            profileData.firstName &&
            profileData.lastName &&
            
            profileData.phone &&
            profileData.dateOfBirth
          ) {
            const businessResponse = await fetch("/api/user/business-status", {
              credentials: "include",
            });

            if (businessResponse.ok) {
              const businessData = await businessResponse.json();

              if (businessData.needsSetup) {
                router.push("/business/onboarding");
                return;
              } else {
                router.push("/dashboard");
                return;
              }
            }
          } else {
          }
        }
      } catch (error) {}

      // Profile is incomplete - show the setup form
      setIsInitializing(false);
    };

    initializeOAuthFlow();
  }, [session, status, router]);

  const handleSetupComplete = useCallback(() => {
    router.push("/business/onboarding");
  }, [router]);

  // Show loading while initializing
  if (isInitializing || status === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#f9fafb",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #e5e7eb",
              borderTop: "4px solid #10b981",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1f2937",
                margin: "0 0 8px 0",
              }}
            >
              Setting up your profile...
            </h2>
            <p
              style={{
                color: "#6b7280",
                margin: 0,
                fontSize: "14px",
              }}
            >
              {status === "loading"
                ? "Verifying your account..."
                : "Preparing your profile setup..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render the profile setup form
  return (
    <BusinessSetupForm
      email={session?.user?.email || ""}
      onSetupComplete={handleSetupComplete}
    />
  );
}
