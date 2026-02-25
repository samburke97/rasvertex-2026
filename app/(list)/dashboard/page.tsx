"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import styles from "./page.module.css";

export default function DashboardPage() {
  const router = useRouter();

  const handleStartNow = () => {
    // Navigate to business onboarding or business creation
    router.push("/business/onboarding");
  };

  const handleLearnMore = () => {
    // Navigate to about page or platform information
    router.push("/about");
  };

  return (
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
          Add your business to the new sports and activity platform to
          <br />
          attract players from all types of fields.
        </p>

        {/* Action Buttons */}
        <div className={styles.buttonContainer}>
          <Button
            variant="primary-green"
            onClick={handleStartNow}
            className={styles.primaryButton}
          >
            Start Now
          </Button>

          <Button
            variant="secondary"
            onClick={handleLearnMore}
            className={styles.secondaryButton}
          >
            Learn More
          </Button>
        </div>
      </div>
    </div>
  );
}
