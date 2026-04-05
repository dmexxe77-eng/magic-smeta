/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        accent: "#4F46E5",
        navy: "#1e2030",
        "accent-light": "#eeeeff",
        "accent-mid": "#c7c4f8",
        muted: "#6b6b7a",
        border: "#e8e8e4",
        card: "#ffffff",
        bg: "#f7f7f5",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
