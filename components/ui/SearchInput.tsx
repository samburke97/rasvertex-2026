"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import styles from "./SearchInput.module.css";

interface SearchInputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  className?: string;
  labelClassName?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function SearchInput({
  id,
  label,
  placeholder = "Search...",
  value: externalValue,
  onChange,
  onSearch,
  onClear,
  className = "",
  labelClassName = "",
  required = false,
  disabled = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(externalValue || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = externalValue !== undefined;
  const inputId =
    id || `search-input-${Math.random().toString(36).substring(2, 9)}`;

  // Update internal value when external value changes
  useEffect(() => {
    if (isControlled) {
      setInternalValue(externalValue);
    }
  }, [externalValue, isControlled]);

  // Debounce search to avoid excessive callbacks
  const debouncedSearch = useCallback(
    (searchValue: string) => {
      if (onSearch) {
        onSearch(searchValue);
      }
    },
    [onSearch]
  );

  // When internal value changes through typing, debounce the search
  useEffect(() => {
    // Skip on initial render
    if (!isControlled && internalValue !== externalValue) {
      const timer = setTimeout(() => {
        debouncedSearch(internalValue);
      }, 300); // 300ms debounce time

      return () => clearTimeout(timer);
    }
  }, [internalValue, debouncedSearch, isControlled, externalValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (!isControlled) {
      setInternalValue(newValue);
    }

    if (onChange) {
      onChange(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSearch) {
      onSearch(isControlled ? externalValue : internalValue);
    }
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue("");
    }

    if (onClear) {
      onClear();
    } else if (onSearch) {
      onSearch("");
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const currentValue = isControlled ? externalValue : internalValue;

  return (
    <div className={`${styles.searchContainer} ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`${styles.label} ${labelClassName}`}
        >
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}

      <div className={styles.inputWrapper}>
        <div className={styles.searchIcon}>
          <Image
            src="/icons/nav-outline/search.svg"
            alt="Search"
            width={18}
            height={18}
          />
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={currentValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={styles.input}
          required={required}
          disabled={disabled}
        />
        {currentValue && (
          <button
            type="button"
            onClick={handleClear}
            className={styles.clearButton}
            aria-label="Clear search"
          >
            <Image
              src="/icons/utility-outline/cross.svg"
              alt="Clear"
              width={18}
              height={18}
            />
          </button>
        )}
      </div>
    </div>
  );
}
