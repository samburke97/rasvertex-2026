"use client";

import React, { useState } from "react";
import styles from "./EditableField.module.css";

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

export default function EditableField({
  value,
  onChange,
  multiline = false,
  placeholder = "Click to edit",
  className = "",
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);

  const commit = () => setEditing(false);

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={commit}
          className={`${styles.textarea} ${className}`}
          rows={5}
        />
      );
    }
    return (
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") commit();
        }}
        className={`${styles.input} ${className}`}
      />
    );
  }

  return (
    <span
      className={`${styles.display} ${!value ? styles.placeholder : ""} ${className}`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  );
}
