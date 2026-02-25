// components/ui/PhoneInput.tsx - Using the CSS module we created
"use client";

import { useState } from "react";
import styles from "./PhoneInput.module.css";

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

const COUNTRIES = [
  { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "+61" },
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", dialCode: "+64" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dialCode: "+49" },
  { code: "FR", name: "France", flag: "🇫🇷", dialCode: "+33" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dialCode: "+81" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", dialCode: "+82" },
  { code: "CN", name: "China", flag: "🇨🇳", dialCode: "+86" },
  { code: "IN", name: "India", flag: "🇮🇳", dialCode: "+91" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", dialCode: "+65" },
];

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
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const selectedCountry =
    COUNTRIES.find((c) => c.dialCode === countryCode) || COUNTRIES[0];

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const selectCountry = (country: any) => {
    onCountryChange(country.dialCode);
    setIsOpen(false);
  };

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
          {/* Country Selector */}
          <div className={styles.countrySelector}>
            <button
              type="button"
              className={styles.countryBtn}
              onClick={toggleDropdown}
              disabled={disabled}
            >
              <span className={styles.flag}>{selectedCountry.flag}</span>
              <span className={styles.code}>{selectedCountry.dialCode}</span>
              <svg
                className={`${styles.arrow} ${isOpen ? styles.arrowUp : ""}`}
                width="12"
                height="12"
                viewBox="0 0 12 12"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
              <>
                <div
                  className={styles.overlay}
                  onClick={() => setIsOpen(false)}
                />
                <div className={styles.dropdown}>
                  {COUNTRIES.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      className={`${styles.option} ${
                        country.dialCode === countryCode ? styles.selected : ""
                      }`}
                      onClick={() => selectCountry(country)}
                    >
                      <span className={styles.flag}>{country.flag}</span>
                      <span className={styles.countryName}>{country.name}</span>
                      <span className={styles.code}>{country.dialCode}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Separator */}
          <div className={styles.separator} />

          {/* Phone Input */}
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
