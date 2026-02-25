"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Button from "./Button";
import styles from "./SearchDropDown.module.css";

interface Option {
  value: string;
  label: string;
}

interface SearchDropDownProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options?: Option[];
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  required?: boolean;
  allowFreeInput?: boolean;
  error?: string | null;
  showClearButton?: boolean;
  disabled?: boolean;
}

export default function SearchDropDown({
  id,
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select",
  className = "",
  labelClassName = "",
  required = false,
  error = null,
  showClearButton = true,
  disabled = false,
}: SearchDropDownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const [searchText, setSearchText] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uniqueId =
    id || `dropdown-${Math.random().toString(36).substring(2, 9)}`;

  // Store previous value to detect changes
  const prevValueRef = useRef(value);
  const prevOptionsRef = useRef(options);

  // Find the display value (label) for the current value
  useEffect(() => {
    // Only update display value if value or options have changed
    if (value !== prevValueRef.current || options !== prevOptionsRef.current) {
      const option = options.find((opt) => opt.value === value);
      setDisplayValue(option ? option.label : value);

      // Update refs
      prevValueRef.current = value;
      prevOptionsRef.current = options;
    }
  }, [value, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Reset search when closing
        setSearchText("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter options based on search text
  const filteredOptions =
    searchText.trim() !== ""
      ? options.filter((option) =>
          option.label.toLowerCase().includes(searchText.toLowerCase())
        )
      : options;

  const handleInputClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen && inputRef.current) {
      // Focus the input when opening dropdown
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isOpen) {
      setSearchText(e.target.value);
    }
  };

  const handleOptionSelect = (option: Option) => {
    setDisplayValue(option.label);
    setIsOpen(false);
    setSearchText("");

    // Prevent the onChange callback from firing if the value hasn't changed
    if (option.value !== value) {
      onChange(option.value);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayValue("");
    setSearchText("");

    // Only call onChange if the value is not already empty
    if (value !== "") {
      onChange("");
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchText("");
    } else if (e.key === "Enter" && filteredOptions.length > 0 && isOpen) {
      handleOptionSelect(filteredOptions[0]);
      e.preventDefault();
    } else if (e.key === "ArrowDown" && isOpen && filteredOptions.length > 0) {
      // Could implement arrow navigation here
      e.preventDefault();
    }
  };

  return (
    <div className={`${styles.dropdownContainer} ${className}`}>
      {label && (
        <label
          htmlFor={uniqueId}
          className={`${styles.label} ${labelClassName}`}
        >
          {label}
          {required && error && <span className={styles.required}>*</span>}
        </label>
      )}

      <div className={styles.wrapper} ref={dropdownRef}>
        <div
          className={`${styles.inputWrapper} ${isOpen ? styles.active : ""} ${
            error ? styles.hasError : ""
          } ${disabled ? styles.disabled : ""}`}
          onClick={disabled ? undefined : handleInputClick}
          tabIndex={disabled ? -1 : 0}
        >
          {!isOpen ? (
            // Display selection when closed
            <>
              <input
                id={uniqueId}
                type="text"
                value={displayValue}
                placeholder={placeholder}
                className={styles.input}
                readOnly
                disabled={disabled}
              />
              {displayValue && showClearButton && (
                <button
                  type="button"
                  onClick={handleClear}
                  className={styles.clearButton}
                  aria-label="Clear selection"
                >
                  <Image
                    src="/icons/utility-outline/cross.svg"
                    alt=""
                    width={18}
                    height={18}
                  />
                </button>
              )}

              <Image
                src="/icons/utility-outline/down.svg"
                alt=""
                width={18}
                height={18}
                className={styles.chevronIcon}
              />
            </>
          ) : (
            // Show search input when open
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={handleSearchInput}
              onKeyDown={handleInputKeyDown}
              placeholder="Search..."
              className={styles.input}
              autoComplete="off"
              disabled={disabled}
            />
          )}
        </div>

        {isOpen && (
          <div className={styles.dropdown}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`${styles.option} ${
                    option.value === value ? styles.selected : ""
                  }`}
                  onClick={() => handleOptionSelect(option)}
                >
                  <span>{option.label}</span>
                </div>
              ))
            ) : (
              <div className={styles.noResults}>No options found</div>
            )}
          </div>
        )}
      </div>

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
