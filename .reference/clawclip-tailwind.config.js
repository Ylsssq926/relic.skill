/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f8fafc',
          raised: '#ffffff',
          overlay: '#f1f5f9',
          border: '#e2e8f0',
          'border-hover': '#cbd5e1',
        },
        accent: {
          DEFAULT: '#3b82c4',
          light: '#60a5fa',
          dim: 'rgba(59,130,196,0.12)',
          glow: 'rgba(59,130,196,0.3)',
        },
        brand: {
          blue: '#3b82c4',
          cyan: '#06b6d4',
          green: '#10b981',
          purple: '#8b5cf6',
          pink: '#ec4899',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
