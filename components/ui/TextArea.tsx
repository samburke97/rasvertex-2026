"use client";

import React, { ChangeEvent } from "react";
import styles from "./TextArea.module.css";

interface TextAreaProps {
  id: string;
  label?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
  maxLength?: number;
  showCharCount?: boolean;
  className?: string;
  textAreaClassName?: string;
  labelClassName?: string;
  rows?: number;
  required?: boolean;
  name?: string;
}

const TextArea: React.FC<TextAreaProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = "",
  disabled = false,
  error = null,
  maxLength,
  showCharCount = false,
  className = "",
  textAreaClassName = "",
  labelClassName = "",
  rows = 4,
  required = false,
  name,
}) => {
  return (
    <div className={`${styles.container} ${className}`}>
      {label && (
        <label htmlFor={id} className={`${styles.label} ${labelClassName}`}>
          {label}
        </label>
      )}

      <div
        className={`${styles.textAreaWrapper} ${error ? styles.hasError : ""}`}
      >
        <textarea
          id={id}
          name={name || id}
          value={value}
          onChange={(e) => {
            if (maxLength && e.target.value.length > maxLength) {
              return;
            }
            onChange(e);
          }}
          className={`${styles.textArea} ${textAreaClassName}`}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={rows}
          required={required}
        />

        {showCharCount && maxLength && (
          <div className={styles.charCount}>
            {value ? value.length : 0}/{maxLength}
          </div>
        )}
      </div>

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
};

export default TextArea;
