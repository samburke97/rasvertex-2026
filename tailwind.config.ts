import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Primary Colors
        "primary-100": "var(--primary-100)",
        "primary-200": "var(--primary-200)",
        "primary-300": "var(--primary-300)",
        "primary-400": "var(--primary-400)",

        // Grey Colors
        "grey-100": "var(--grey-100)",
        "grey-200": "var(--grey-200)",
        "grey-300": "var(--grey-300)",
        "grey-400": "var(--grey-400)",
        "grey-500": "var(--grey-500)",
        "grey-600": "var(--grey-600)",

        // Red Colors
        "red-100": "var(--red-100)",
        "red-200": "var(--red-200)",
        "red-300": "var(--red-300)",
        "red-400": "var(--red-400)",

        // Green Colors
        "green-100": "var(--green-100)",
        "green-200": "var(--green-200)",
        "green-300": "var(--green-300)",
        "green-400": "var(--green-400)",

        // Blue Colors
        "blue-100": "var(--blue-100)",
        "blue-200": "var(--blue-200)",
        "blue-300": "var(--blue-300)",
        "blue-400": "var(--blue-400)",

        // Yellow Colors
        "yellow-100": "var(--yellow-100)",
        "yellow-200": "var(--yellow-200)",
        "yellow-300": "var(--yellow-300)",
        "yellow-400": "var(--yellow-400)",
      },
    },
  },
  plugins: [],
};

export default config;
