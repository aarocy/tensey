/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: {
          bg: "#18181b",
          grid: "#31313a",
        },
        surface: {
          0: "#18181b",
          1: "#1f1f23",
          2: "#25252b",
          3: "#2b2b33",
          4: "#31313a",
        },
        border: {
          DEFAULT: "#31313a",
          strong: "#3f3f46",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#60a5fa",
          muted: "#1d4ed8",
        },
        error: {
          DEFAULT: "#ff8a8a",
          muted: "#7e4343",
          bg: "#2c1717",
        },
        warning: {
          DEFAULT: "#e6bf7a",
          muted: "#7c6641",
          bg: "#2a2418",
        },
        success: {
          DEFAULT: "#99d1ad",
          muted: "#4b6b58",
          bg: "#18251d",
        },
        text: {
          primary: "#f4f4f5",
          secondary: "#a1a1aa",
          tertiary: "#71717a",
          disabled: "#71717a",
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
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
      },
    },
  },
  plugins: [],
};
