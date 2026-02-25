// components/ui/TextInput.tsx - MINIMAL FIX - Only fix the loading prop issue
"use client";

import React, {
  ChangeEvent,
  ReactNode,
  useState,
  forwardRef,
  InputHTMLAttributes,
  KeyboardEvent,
} from "react";
import styles from "./TextInput.module.css";

interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "prefix"> {
  id: string;
  label?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
  error?: string | null;
  showCharCount?: boolean;
  labelClassName?: string;
  inputClassName?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  prefix?: string;
  loading?: boolean; // CUSTOM PROP - NOT PASSED TO DOM
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      id,
      label,
      value,
      onChange,
      onEnter,
      placeholder = "",
      disabled = false,
      error = null,
      maxLength,
      showCharCount = false,
      className = "",
      inputClassName = "",
      labelClassName = "",
      leftIcon,
      rightIcon,
      type = "text",
      required = false,
      autoFocus = false,
      name,
      prefix,
      step,
      min,
      loading = false, // CUSTOM PROP - EXTRACT IT
      ...rest // REST PROPS FOR INPUT ELEMENT
    },
    ref
  ) => {
    const [isInputFocused, setIsInputFocused] = useState(false);

    const displayValue =
      type === "number" &&
      (value === "0" || parseFloat(value) === 0) &&
      isInputFocused
        ? ""
        : value;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsInputFocused(true);
      if (rest.onFocus) {
        rest.onFocus(e);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsInputFocused(false);
      if (rest.onBlur) {
        rest.onBlur(e);
      }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (maxLength && e.target.value.length > maxLength) {
        return;
      }
      onChange(e);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
      }
      if (rest.onKeyDown) {
        rest.onKeyDown(e);
      }
    };

    return (
      <div className={`${styles.container} ${className}`}>
        {label && (
          <label htmlFor={id} className={`${styles.label} ${labelClassName}`}>
            {label}
            {required && error && (
              <span className={styles.required}>*</span>
            )}{" "}
          </label>
        )}

        <div
          className={`${styles.inputWrapper} ${error ? styles.hasError : ""}`}
        >
          {leftIcon && <div className={styles.leftIcon}>{leftIcon}</div>}
          {prefix && <span className={styles.prefix}>{prefix}</span>}

          <input
            {...rest}
            id={id}
            name={name || id}
            type={type}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`${styles.input} ${inputClassName} ${
              type === "number" ? styles.noSpinner : ""
            }`}
            placeholder={placeholder}
            disabled={disabled || loading}
            maxLength={maxLength}
            autoFocus={autoFocus}
            required={required}
            step={step}
            min={min}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
          />

          {rightIcon && <div className={styles.rightIcon}>{rightIcon}</div>}

          {loading && (
            <div className={styles.loadingIndicator}>
              <div className={styles.spinner} />
            </div>
          )}

          {showCharCount && maxLength && (
            <div className={styles.charCount}>
              {value ? value.length : 0}/{maxLength}
            </div>
          )}
        </div>

        {error && (
          <p id={`${id}-error`} className={styles.errorText}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";

export default TextInput;
