"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import DataTable, { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import styles from "./page.module.css";
import TitleDescription from "@/components/ui/TitleDescription";
import EmptyState from "@/components/ui/EmptyState";

interface Location {
  id: string;
  name: string;
  logoUrl: string | null;
  imageUrl: string | null;
  status: "Active" | "Inactive";
  establishment: string;
  lastUpdated: string;
}

export default function LocationsPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort locations with active ones first, then by name
  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      // First sort by status - Active locations first
      if (a.status === "Active" && b.status !== "Active") return -1;
      if (a.status !== "Active" && b.status === "Active") return 1;

      // Then sort by name alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [locations]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/locations${
            searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""
          }`
        );

        // For debugging, get the raw response text first
        const responseText = await response.text();

        // Try to parse the response as JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse response as JSON:", e);
          throw new Error("Invalid response format from server");
        }

        if (!response.ok) {
          const errorMessage = data?.error || "Failed to fetch locations";
          throw new Error(errorMessage);
        }

        setLocations(data);
      } catch (error) {
        console.error("Error fetching locations:", error);
        setError((error as Error).message);
        setLocations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocations();
  }, [searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleRowClick = (location: Location) => {
    setSelectedId(location.id);
    router.push(`/locations/${location.id}`);
  };

  const columns: Column<Location>[] = [
    {
      key: "name",
      header: "Location Name",
      width: "40%",
      render: (location) => (
        <div className={styles.locationName}>
          <div className={styles.imageContainer}>
            {location.logoUrl ? (
              <Image
                src={location.logoUrl}
                alt={location.name}
                width={32}
                height={32}
                className={styles.locationImage}
              />
            ) : (
              <div className={styles.placeholderImage}>
                {location.name.charAt(0)}
              </div>
            )}
          </div>
          <span>{location.name}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "15%",
      render: (location) => (
        <span
          className={`${styles.status} ${
            location.status === "Active" ? styles.active : styles.inactive
          }`}
        >
          {location.status}
        </span>
      ),
    },
    {
      key: "establishment",
      header: "Establishment",
      width: "25%",
    },
    {
      key: "lastUpdated",
      header: "Last Updated",
      width: "20%",
      render: (location) => {
        const date = new Date(location.lastUpdated);
        return date.toLocaleDateString();
      },
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <TitleDescription title={"Locations"} count={locations.length} />
        <div className={styles.actions}>
          <Button variant="secondary">Upload</Button>
          <Button
            onClick={() => router.push("/locations/create")}
            variant="primary"
          >
            Create
          </Button>
        </div>
      </div>

      <div className={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onClear={() => handleSearch("")}
          placeholder="Search locations..."
        />
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <p>Error: {error}</p>
          <Button onClick={() => window.location.reload()} variant="secondary">
            Try Again
          </Button>
        </div>
      )}

      {sortedLocations.length === 0 && !isLoading ? (
        <EmptyState
          message="No locations found."
          createNewLink="/locations/create"
        />
      ) : (
        <DataTable
          columns={columns}
          data={sortedLocations}
          keyField="id"
          isLoading={isLoading}
          onRowClick={handleRowClick}
          selectedId={selectedId}
          itemType="location"
          emptyMessage="No locations found."
        />
      )}
    </div>
  );
}
