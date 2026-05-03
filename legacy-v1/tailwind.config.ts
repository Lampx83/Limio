import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Tiger orange — primary
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        // Accents
        sunny: "#fbbf24",   // vàng tươi
        coral: "#fb7185",   // hồng san hô
        mint: "#34d399",    // xanh bạc hà
        sky: "#38bdf8",     // xanh trời
        grape: "#a855f7",   // tím nho
      },
      backgroundImage: {
        "tiger-stripes":
          "repeating-linear-gradient(45deg, transparent 0, transparent 10px, rgba(234,88,12,0.08) 10px, rgba(234,88,12,0.08) 14px)",
      },
    },
  },
  plugins: [],
};

export default config;
