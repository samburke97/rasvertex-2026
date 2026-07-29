// components/ui/PhoneInput.tsx
"use client";

import { useState } from "react";
import styles from "./PhoneInput.module.css";
import CountryCodeSelect from "./CountryCodeSelect";

interface PhoneInputProps {
  id: string;
  label: string;
  value: string;
  countryCode: string;
  onChange: (value: string) => void;
  onCountryChange: (countryCode: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function PhoneInput({
  id,
  label,
  value,
  countryCode,
  onChange,
  onCountryChange,
  placeholder = "Enter your mobile number",
  error,
  required = false,
  disabled = false,
}: PhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow all characters, let the parent component handle validation
    onChange(e.target.value);
  };

  const containerClasses = [
    styles.phoneContainer,
    isFocused && styles.focused,
    error && styles.error,
    disabled && styles.disabled,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.wrapper}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && error && <span className={styles.required}>*</span>}
        </label>
      )}

      <div className={styles.inputWrapper}>
        <div className={containerClasses}>
          <div className={styles.countrySelector}>
            <CountryCodeSelect
              value={countryCode}
              onChange={onCountryChange}
              variant="inline"
            />
          </div>

          <div className={styles.separator} />

          <input
            id={id}
            type="tel"
            value={value}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className={styles.phoneInput}
          />
        </div>

        {error && <div className={styles.errorText}>{error}</div>}
      </div>
    </div>
  );
}
