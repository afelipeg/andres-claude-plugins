/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Protocol design system
        accent: {
          DEFAULT: '#00F5FF',
          hover: '#00D4DD',
          foreground: '#0A0A0F',
        },
        secondary: {
          DEFAULT: '#FF00FF',
          hover: '#DD00DD',
          foreground: '#0A0A0F',
        },
        tertiary: {
          DEFAULT: '#7000FF',
          hover: '#5C00DD',
          foreground: '#FFFFFF',
        },
        // Glass tokens
        glass: {
          bg: 'rgba(255, 255, 255, 0.05)',
          'bg-hover': 'rgba(255, 255, 255, 0.10)',
          'bg-active': 'rgba(255, 255, 255, 0.15)',
          border: 'rgba(255, 255, 255, 0.10)',
          'border-hover': 'rgba(255, 255, 255, 0.20)',
        },
        // Legacy brand (blue) — kept for chart colors & demo pages
        brand: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b8dbff',
          300: '#7abfff',
          400: '#339dff',
          500: '#0077e6',
          600: '#005ec4',
          700: '#004a9e',
          800: '#003d82',
          900: '#00316b',
        },
        waste: '#ef4444',
        productive: '#22c55e',
        warning: '#f59e0b',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'glass-shimmer': 'glass-shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'glass-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
