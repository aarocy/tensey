/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      colors: {
        canvas: {
          bg: "#111113",
          grid: "#1c1c1f",
        },
        surface: {
          0: "#111113",
          1: "#18181b",
          2: "#1f1f23",
          3: "#27272c",
          4: "#303036",
        },
        border: {
          DEFAULT: "#2e2e34",
          strong: "#3f3f47",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#60a5fa",
          muted: "#1d4ed8",
        },
        error: {
          DEFAULT: "#ef4444",
          muted: "#7f1d1d",
          bg: "#1c0a0a",
        },
        warning: {
          DEFAULT: "#f59e0b",
          muted: "#92400e",
          bg: "#1c1000",
        },
        success: {
          DEFAULT: "#22c55e",
          muted: "#14532d",
          bg: "#071a0f",
        },
        text: {
          primary: "#e4e4e7",
          secondary: "#a1a1aa",
          tertiary: "#71717a",
          disabled: "#52525b",
        },
      },
      fontSize: {
        "2xs": ["10px", "14px"],
        xs: ["11px", "16px"],
        sm: ["12px", "18px"],
        base: ["13px", "20px"],
        md: ["14px", "20px"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "5px",
        md: "7px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
