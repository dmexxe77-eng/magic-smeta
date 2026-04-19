/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg:           "#FAFAF9",
        card:         "#FFFFFF",
        surface2:     "#F4F4F2",
        border:       "#E6E6E1",
        borderStrong: "#D4D4CF",

        // Brand
        navy:         "#1E2030",
        navy2:        "#2A2D44",
        accent:       "#5E5CE6",
        "accent-soft":"#EEEEFF",
        "accent-ink": "#3D3BB8",
        "accent-light":"#EEEEFF",
        "accent-mid": "#C7C4F8",

        // Text
        ink:          "#1E2030",
        muted:        "#5C5C6B",
        "ink-subtle": "#9999A3",

        // Status
        success:      "#0F9D58",
        warning:      "#E5811A",
        danger:       "#D93025",
        info:         "#1A73E8",
      },
    },
  },
  plugins: [],
};
