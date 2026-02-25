"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TextInput from "@/components/ui/TextInput";
import SearchInput from "@/components/ui/SearchInput";
import SelectableDataTable from "@/components/ui/SelectableDataTable";
import ActionHeader from "@/components/layouts/headers/ActionHeader";
import TitleDescription from "@/components/ui/TitleDescription";
import EmptyState from "@/components/ui/EmptyState";
import Toast from "@/components/ui/Toast";
import styles from "./EditGroupPage.module.css";
import LoadingSpinner from "../ui/LoadingSpinner";

interface Tag {
  id: string;
  name: string;
  imageUrl?: string;
}

interface Group {
  id: string;
  name: string;
  tags: Tag[];
}

interface EditGroupPageProps {
  groupId: string;
}

export default function EditGroupPage({ groupId }: EditGroupPageProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
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

  // Fetch the group data
  useEffect(() => {
    const fetchGroup = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/groups/${groupId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch group");
        }
        const data = await response.json();
        setGroup(data);
        setName(data.name);
        setSelectedTags(data.tags || []);
      } catch (error) {
        console.error("Error fetching group:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch group"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (groupId) {
      fetchGroup();
    }
  }, [groupId]);

  // Fetch available tags
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

    if (error) {
      setError(null);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
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

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this group? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete group");
      }

      setToast({ message: "Group deleted successfully", type: "success" });

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
      setIsSubmitting(false);
    }
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
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          tags: selectedTags.map((tag) => tag.id),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update group");
      }

      setToast({ message: "Group updated successfully", type: "success" });

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

  if (isLoading && !group) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <ActionHeader
        primaryAction={handleSubmit}
        secondaryAction={() => router.back()}
        primaryLabel="Save"
        isProcessing={isSubmitting}
        processingLabel="Saving..."
        variant="edit"
        deleteAction={handleDelete}
        backIcon={
          <Image
            src="/icons/utility-outline/cross.svg"
            width={20}
            height={20}
            alt="Go back"
            priority={true}
          />
        }
      />

      <div>
        <div className={styles.container}>
          <TitleDescription title={group?.name || "Edit Group"} />
          <div>
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
              <div className={styles.searchContainer}>
                <SearchInput
                  label="Tag List"
                  onSearch={handleSearch}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onClear={() => handleSearch("")}
                  placeholder="Search Tags"
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

          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
