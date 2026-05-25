import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans Arabic"', "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#2c5f2d",
          light: "#97bc62",
        },
        accent: "#f4a261",
      },
    },
  },
  plugins: [],
} satisfies Config;
