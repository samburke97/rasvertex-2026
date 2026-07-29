"use client";

import { useState, useRef, useEffect } from "react";
import { RiArrowDownSLine } from "react-icons/ri";
import styles from "./CountryCodeSelect.module.css";
import { COUNTRY_DIAL_CODES } from "@/lib/constants/countries";

interface CountryCodeSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** "inline" strips the boxed border/background — for composing inside
   *  another input's own container (e.g. PhoneInput). Default "boxed" is
   *  the standalone look. */
  variant?: "boxed" | "inline";
}

interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

const COUNTRY_CODES: CountryCode[] = COUNTRY_DIAL_CODES.map((c) => ({
  code: c.dialCode,
  name: c.name,
  flag: c.flag,
}));

export default function CountryCodeSelect({
  value,
  onChange,
  variant = "boxed",
}: CountryCodeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the selected country
  const selectedCountry = COUNTRY_CODES.find(
    (country) => country.code === value
  ) || { code: value, name: "Unknown", flag: "🌍" };

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.container} ref={dropdownRef}>
      <div
        className={`${styles.selector} ${variant === "inline" ? styles.inline : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.flag}>{selectedCountry.flag}</span>
        <span className={styles.code}>{selectedCountry.code}</span>
        <span className={styles.arrow}>
          <RiArrowDownSLine />
        </span>
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          {COUNTRY_CODES.map((country) => (
            <div
              key={country.code}
              className={`${styles.option} ${
                country.code === value ? styles.selected : ""
              }`}
              onClick={() => handleSelect(country.code)}
            >
              <span className={styles.flag}>{country.flag}</span>
              <span className={styles.name}>{country.name}</span>
              <span className={styles.code}>{country.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
