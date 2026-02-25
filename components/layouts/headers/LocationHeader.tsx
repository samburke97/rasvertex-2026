"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import IconButton from "@/components/ui/IconButton";
import { checkActivationStatus } from "@/lib/services/locationEditService";
import styles from "./LocationHeader.module.css";

interface LocationHeaderProps {
  isActive: boolean;
  locationId: string;
  onToggleActive?: (isActive: boolean) => void;
  showBackButton?: boolean;
  className?: string;
}

const LocationHeader: React.FC<LocationHeaderProps> = ({
  isActive,
  locationId,
  onToggleActive,
  showBackButton = true,
  className = "",
}) => {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [isLoading, setIsLoading] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isHovering, setIsHovering] = useState(false); // Added state to track hover

  // Fetch activation status when component mounts or active state changes
  useEffect(() => {
    const fetchActivationStatus = async () => {
      setIsLoading(true);
      try {
        const result = await checkActivationStatus(locationId);

        // Update active state if it changed
        if (active !== result.isActive) {
          setActive(result.isActive);
          if (onToggleActive) {
            onToggleActive(result.isActive);
          }
        }

        // Update missing fields if not active
        if (!result.isActive && result.missingFields) {
          setMissingFields(result.missingFields);
        } else {
          setMissingFields([]);
        }
      } catch (error) {
        console.error("Error fetching activation status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivationStatus();
  }, [locationId, active, onToggleActive]);

  const handleBack = () => {
    router.push("/locations");
  };

  return (
    <header className={`${styles.header} ${className}`}>
      <div className={styles.headerContent}>
        <div className={styles.leftSection}>
          {showBackButton && (
            <IconButton
              icon={
                <Image
                  src="/icons/utility-outline/back.svg"
                  alt="Go Back"
                  width={20}
                  height={20}
                />
              }
              onClick={handleBack}
              aria-label="Go back to locations"
              variant="ghost"
            />
          )}
        </div>

        <div className={styles.statusContainer}>
          <div
            className={styles.statusIndicator}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <div
              className={`${styles.statusDot} ${
                active ? styles.active : styles.inactive
              }`}
            />
            <span className={styles.statusText}>
              {isLoading
                ? "Checking status..."
                : active
                  ? "Active"
                  : "Inactive"}
            </span>
          </div>

          {!active && missingFields.length > 0 && isHovering && (
            <div className={styles.missingFieldsContainer}>
              <p className={styles.missingFieldsTitle}>
                Complete the following to activate:
              </p>
              <ul className={styles.missingFieldsList}>
                {missingFields.map((field, index) => (
                  <li key={index} className={styles.missingField}>
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default LocationHeader;
