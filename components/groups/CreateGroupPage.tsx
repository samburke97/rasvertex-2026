"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TextInput from "@/components/ui/TextInput";
import SearchInput from "@/components/ui/SearchInput";
import SelectableDataTable from "@/components/ui/SelectableDataTable";
import EmptyState from "@/components/ui/EmptyState";
import Toast from "@/components/ui/Toast";
import ActionHeader from "@/components/layouts/headers/ActionHeader";
import TitleDescription from "@/components/ui/TitleDescription";
import styles from "./CreateGroupPage.module.css";

interface Tag {
  id: string;
  name: string;
  imageUrl?: string;
}

export default function CreateGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch available tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) {
          throw new Error("Failed to fetch tags");
        }
        const data = await response.json();
        setAvailableTags(data);
        setFilteredTags(data);
      } catch (error) {
        console.error("Error fetching tags:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, []);

  // Filter tags based on search query
  useEffect(() => {
    if (searchQuery) {
      const filtered = availableTags.filter((tag) =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags(availableTags);
    }
  }, [searchQuery, availableTags]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);

    // Clear error when user starts typing again after seeing an error
    if (error) {
      setError(null);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleAddTag = async (tag: Tag) => {
    // Check if tag is already selected
    if (!selectedTags.some((selectedTag) => selectedTag.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
      setToast({ message: `${tag.name} Added`, type: "success" });

      // Hide toast after 3 seconds
      setTimeout(() => {
        setToast(null);
      }, 3000);
    }

    return Promise.resolve();
  };

  const handleRemoveTag = async (tagId: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag.id !== tagId));
    return Promise.resolve();
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    if (!name.trim()) {
      setError("Group name is required");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          tags: selectedTags.map((tag) => tag.id),
        }),
      });

      // Handle various HTTP status codes
      if (response.status === 409) {
        const data = await response.json();
        setError(data.error || "A group with this name already exists");
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create group");
      }

      setToast({ message: "Group created successfully", type: "success" });

      // Navigate back to groups page after a short delay
      setTimeout(() => {
        router.push("/groups");
      }, 1500);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ActionHeader
        primaryAction={handleSubmit}
        secondaryAction={() => router.back()}
        primaryLabel="Create"
        secondaryLabel="Cancel"
        isProcessing={isSubmitting}
      />

      <div className={styles.pageContainer}>
        <div className={styles.container}>
          <TitleDescription title={"Create Group"} />

          <div className={styles.formSection}>
            <div className={styles.inputGroup}>
              <TextInput
                id="groupName"
                label="Group Name"
                value={name}
                onChange={handleNameChange}
                placeholder="Enter group name"
                disabled={isSubmitting}
                error={error}
                maxLength={50}
                showCharCount={true}
              />
            </div>

            <div className={styles.tagsSection}>
              <h2 className={styles.label}>Tag List</h2>
              <div className={styles.searchContainer}>
                <SearchInput
                  onSearch={handleSearch}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onClear={() => handleSearch("")}
                  placeholder="Search and add tags"
                />
              </div>

              {filteredTags.length === 0 && !isLoading ? (
                <EmptyState
                  message="No tags found."
                  createNewLink="/tags/create"
                  createNewLabel="Create New"
                />
              ) : (
                <SelectableDataTable
                  items={filteredTags}
                  selected={selectedTags}
                  onAdd={handleAddTag}
                  onRemove={handleRemoveTag}
                  isLoading={isLoading}
                  emptyMessage="No tags found."
                  itemType="tag"
                  nameColumnConfig={{ header: "Tag Name", align: "left" }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
