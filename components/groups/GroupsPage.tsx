"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SearchInput from "../ui/SearchInput";
import Button from "../ui/Button";
import DataTable, { Column } from "../ui/DataTable";
import EmptyState from "../ui/EmptyState";
import styles from "./GroupsPage.module.css";
import TitleDescription from "../ui/TitleDescription";

interface Group {
  id: string;
  name: string;
  tagCount: number;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/groups");
        if (!response.ok) {
          throw new Error("Failed to fetch groups");
        }
        const data = await response.json();
        setGroups(data);
        setFilteredGroups(data);
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = groups.filter((group) =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredGroups(filtered);
    } else {
      setFilteredGroups(groups);
    }
  }, [searchQuery, groups]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleRowClick = (group: Group) => {
    router.push(`/groups/${group.id}`);
  };

  const handleCreateGroup = () => {
    router.push("/groups/create");
  };

  const columns: Column<Group>[] = [
    {
      key: "name",
      header: "Group Name",
      render: (row) => (
        <div className={styles.groupNameCell}>
          <span>{row.name}</span>
        </div>
      ),
    },
    {
      key: "tagCount",
      header: "Tags",
      width: "100px",
      align: "right",
    },
  ];

  return (
    <div className={styles.pageContainer}>
      <div className={styles.container}>
        <div className={styles.header}>
          <TitleDescription title={"Groups"} count={groups.length} />
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => {}}>
              Upload
            </Button>
            <Button onClick={handleCreateGroup}>Create</Button>
          </div>
        </div>

        <div className={styles.searchContainer}>
          <SearchInput
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onClear={() => handleSearch("")}
            placeholder="Search our group database"
          />
        </div>

        {filteredGroups.length === 0 && !isLoading ? (
          <EmptyState
            message="No groups found."
            createNewLink="/groups/create"
            createNewLabel="Create Group"
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredGroups}
            keyField="id"
            onRowClick={handleRowClick}
            isLoading={isLoading}
            itemType="group"
          />
        )}
      </div>
    </div>
  );
}
