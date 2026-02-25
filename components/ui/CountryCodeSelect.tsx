"use client";

import { useState, useRef, useEffect } from "react";
import { RiArrowDownSLine } from "react-icons/ri";
import styles from "./CountryCodeSelect.module.css";

interface CountryCodeSelectProps {
  value: string;
  onChange: (value: string) => void;
}

interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

// Most common country codes
const COUNTRY_CODES: CountryCode[] = [
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+1", name: "United States", flag: "🇺🇸" },
  { code: "+353", name: "Ireland", flag: "🇮🇪" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+34", name: "Spain", flag: "🇪🇸" },
  { code: "+39", name: "Italy", flag: "🇮🇹" },
  { code: "+31", name: "Netherlands", flag: "🇳🇱" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+351", name: "Portugal", flag: "🇵🇹" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+82", name: "South Korea", flag: "🇰🇷" },
];

export default function CountryCodeSelect({
  value,
  onChange,
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
      <div className={styles.selector} onClick={() => setIsOpen(!isOpen)}>
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
