import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F7FEE7",
          100: "#ECFCCB",
          200: "#D9F99D",
          300: "#BEF264",
          400: "#A3E635",
          500: "#84CC16",
          600: "#65A30D",
          700: "#4D7C0F",
          800: "#3F6212",
          900: "#365314",
        },
        accent: {
          50: "#FFF8E6",
          100: "#FFEFC2",
          200: "#FFE08A",
          300: "#FCC94F",
          400: "#F8B324",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
        success: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
        danger: {
          50: "#FFF1F2",
          100: "#FFE4E6",
          500: "#E11D48",
          600: "#BE123C",
          700: "#9F1239",
        },
        // Amber — trước đây thiếu, khiến mọi class `warning-*` không sinh CSS.
        warning: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
          950: "#451A03",
        },
      },
      // Balanced modular type scale (~1.18 ratio). Slightly larger body for readability
      // while preserving Tailwind's heading hierarchy. Headings bumped lightly so visual
      // rhythm stays harmonious.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.125rem" }],   // 13px
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],   // 15px
        base: ["1.0625rem", { lineHeight: "1.625rem" }], // 17px
        lg: ["1.1875rem", { lineHeight: "1.75rem" }],    // 19px
        xl: ["1.375rem", { lineHeight: "1.875rem" }],    // 22px
        "2xl": ["1.625rem", { lineHeight: "2.125rem" }], // 26px
        "3xl": ["1.9375rem", { lineHeight: "2.375rem" }], // 31px
        "4xl": ["2.375rem", { lineHeight: "2.625rem" }], // 38px
        "5xl": ["3rem", { lineHeight: "1" }],            // 48px
        "6xl": ["3.75rem", { lineHeight: "1" }],         // 60px
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)",
        "card-hover": "0 2px 4px 0 rgb(15 23 42 / 0.06), 0 12px 24px -8px rgb(236 72 153 / 0.22)",
        "brand-glow": "0 8px 24px -8px rgb(236 72 153 / 0.55)",
      },
      backgroundImage: {
        // Watermelon — lime rind fading through to pink flesh.
        "brand-gradient":
          "linear-gradient(135deg, #84CC16 0%, #65A30D 35%, #EC4899 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, #F7FEE7 0%, #ECFCCB 50%, #FCE7F3 100%)",
        "hero-grid":
          "radial-gradient(circle at 1px 1px, rgb(101 163 13 / 0.18) 1px, transparent 0)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "overlay-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "nav-swap-in": {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "dialog-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "drawer-in-left": { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(0)" } },
        "note-pop-in": {
          "0%": { opacity: "0", transform: "scale(0.7) rotate(var(--note-rot, 0deg))" },
          "60%": { opacity: "1", transform: "scale(1.05) rotate(var(--note-rot, 0deg))" },
          "100%": { opacity: "1", transform: "scale(1) rotate(var(--note-rot, 0deg))" },
        },
        // A6.6 — avatar giám khảo AI trong phòng vấn đáp (OralAiAvatar).
        "avatar-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "avatar-blink": {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "96%": { transform: "scaleY(0.1)" },
        },
        "avatar-talk-mouth": {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
        "avatar-listen-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "avatar-think-tilt": {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        "avatar-think-dot": {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "40%": { transform: "translateY(-3px)", opacity: "1" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.4s ease-out both",
        "overlay-in": "overlay-in 0.2s ease-out both",
        "nav-swap-in": "nav-swap-in 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "dialog-in": "dialog-in 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "drawer-in-left": "drawer-in-left 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "note-pop-in": "note-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "avatar-bob": "avatar-bob 3s ease-in-out infinite",
        "avatar-blink": "avatar-blink 4.5s ease-in-out infinite",
        "avatar-talk-mouth": "avatar-talk-mouth 0.35s ease-in-out infinite",
        "avatar-listen-ring": "avatar-listen-ring 1.6s ease-out infinite",
        "avatar-think-tilt": "avatar-think-tilt 1.2s ease-in-out infinite",
        "avatar-think-dot": "avatar-think-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [typography],
};

export default config;
