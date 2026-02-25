"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import styles from "./LocationsRequestsPage.module.css";
import TitleDescription from "@/components/ui/TitleDescription";

export default function LocationsRequestsPage() {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <TitleDescription title={"Location Requests"} />
        <div className={styles.actions}>
          <Button
            onClick={() => router.push("/locations")}
            variant="secondary"
            className={styles.viewAllButton}
          >
            View All Locations
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.emptyState}>
          <p>No location requests at this time.</p>
          <p className={styles.emptyStateDescription}>
            Location requests will appear here when users submit new locations.
          </p>
        </div>
      </div>
    </div>
  );
}
