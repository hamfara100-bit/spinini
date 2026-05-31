/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#7C5CFF",
        secondary: "#FFB347",
        success: "#34D399",
        warning: "#F59E0B",
        error: "#EF4444",
        bgLight: "#FAF7FF",
        bgDark: "#0E0B1F",
        surfaceLight: "#FFFFFF",
        surfaceDark: "#1A1633",
        pastel: {
          pink: "#FFD6E0",
          blue: "#C6F1FF",
          green: "#D9F7C5",
          yellow: "#FFE7A8",
          purple: "#E2D5FF",
          orange: "#FFD0B0",
          sky: "#B8E6FF",
          rose: "#FFC1E3",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
