const config = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#3b82c4",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82c4",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        /* Warm accent palette for relic types */
        warm: {
          human: "#D97706",
          pet: "#D4A574",
          relationship: "#BE185D",
          team: "#4A6FA5",
          place: "#65A30D",
          moment: "#475569",
          public: "#7C3AED",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          warm: "#FFFDF9",
        },
        foreground: {
          DEFAULT: "#1C1917",
          secondary: "#44403C",
          muted: "#78716C",
          faint: "#A8A29E",
        },
      },
      borderRadius: {
        sm: "12px",
        md: "18px",
        lg: "24px",
        xl: "32px",
      },
      boxShadow: {
        soft: "0 2px 12px rgba(28, 25, 23, 0.04)",
        medium: "0 4px 20px rgba(28, 25, 23, 0.06)",
        elevated: "0 12px 40px rgba(28, 25, 23, 0.08)",
        card: "0 8px 30px rgba(28, 25, 23, 0.07)",
        brand: "0 8px 30px rgba(59, 130, 196, 0.2)",
      },
      maxWidth: {
        container: "1200px",
      },
      fontFamily: {
        display: [
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"STSong"',
          '"SimSun"',
          "Georgia",
          "serif",
        ],
        sans: [
          '-apple-system',
          '"BlinkMacSystemFont"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        display: [
          "clamp(2.5rem, 5vw + 1rem, 4.5rem)",
          { lineHeight: "1.08", letterSpacing: "-0.02em", fontWeight: "800" },
        ],
        'heading-1': [
          "clamp(2rem, 4vw + 0.5rem, 3rem)",
          { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "700" },
        ],
        'heading-2': [
          "clamp(1.5rem, 3vw + 0.25rem, 2.25rem)",
          { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "700" },
        ],
        'heading-3': ["1.375rem", { lineHeight: "1.35", fontWeight: "600" }],
      },
      transitionTimingFunction: {
        entrance: "cubic-bezier(0.22, 1, 0.36, 1)",
        exit: "cubic-bezier(0.7, 0, 0.84, 0)",
        interaction: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      animation: {
        'fade-in-up': "fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        'float-gentle': "float-gentle 6s ease-in-out infinite",
      },
    },
  },
};

export default config;
