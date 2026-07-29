// lib/constants/countries.ts
// Single source of country dial codes, shared by CountryCodeSelect and
// PhoneInput (previously two separate, drifted lists).

export interface CountryDialCode {
  dialCode: string;
  name: string;
  flag: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { dialCode: "+61", name: "Australia", flag: "🇦🇺" },
  { dialCode: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { dialCode: "+1", name: "United States", flag: "🇺🇸" },
  { dialCode: "+64", name: "New Zealand", flag: "🇳🇿" },
  { dialCode: "+353", name: "Ireland", flag: "🇮🇪" },
  { dialCode: "+33", name: "France", flag: "🇫🇷" },
  { dialCode: "+49", name: "Germany", flag: "🇩🇪" },
  { dialCode: "+34", name: "Spain", flag: "🇪🇸" },
  { dialCode: "+39", name: "Italy", flag: "🇮🇹" },
  { dialCode: "+31", name: "Netherlands", flag: "🇳🇱" },
  { dialCode: "+65", name: "Singapore", flag: "🇸🇬" },
  { dialCode: "+91", name: "India", flag: "🇮🇳" },
  { dialCode: "+86", name: "China", flag: "🇨🇳" },
  { dialCode: "+351", name: "Portugal", flag: "🇵🇹" },
  { dialCode: "+55", name: "Brazil", flag: "🇧🇷" },
  { dialCode: "+81", name: "Japan", flag: "🇯🇵" },
  { dialCode: "+82", name: "South Korea", flag: "🇰🇷" },
];
