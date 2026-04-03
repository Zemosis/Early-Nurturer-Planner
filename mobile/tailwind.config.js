/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#387F39",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#A2CA71",
          foreground: "#2C3E2F",
        },
        accent: {
          DEFAULT: "#F6E96B",
          foreground: "#2C3E2F",
        },
        destructive: {
          DEFAULT: "#d4183d",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#BEDC74",
          foreground: "#5C6B5E",
        },
        background: "#FAF9F6",
        foreground: "#2C3E2F",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#2C3E2F",
        },
        border: "rgba(0, 0, 0, 0.08)",
        input: "#f8f8f5",
        ring: "#A2CA71",
      },
      borderRadius: {
        sm: "12px",
        md: "14px",
        lg: "16px",
        xl: "20px",
      },
    },
  },
  plugins: [],
};
