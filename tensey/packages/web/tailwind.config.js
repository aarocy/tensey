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
          bg: "#17191c",
          grid: "#2b3036",
        },
        surface: {
          0: "#17191c",
          1: "#1d2024",
          2: "#252a30",
          3: "#2b3036",
          4: "#39414a",
        },
        border: {
          DEFAULT: "#3a4047",
          strong: "#59616b",
        },
        accent: {
          DEFAULT: "#7ea0c9",
          hover: "#9db6d4",
          muted: "#526b89",
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
          primary: "#edf0f4",
          secondary: "#c0c6cf",
          tertiary: "#99a1ab",
          disabled: "#6b7480",
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
