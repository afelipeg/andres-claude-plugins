/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // App accent (matches login page green CTA)
        accent: {
          DEFAULT: '#00e5a0',
          hover: '#00c98d',
          foreground: '#09090B',
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
    },
  },
  plugins: [],
};
