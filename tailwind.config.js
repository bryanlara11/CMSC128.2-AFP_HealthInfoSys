/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // AFP Medical Corps HSEU Color Palette (from PDF & Mockups)
        navy: {
          900: '#162A2C',  // Midnight / Navy Header
          800: '#2F4156',  // Darker Navy
        },
        teal: {
          600: '#567CBD',  // Teal accent
          500: '#4A6FA5',
        },
        forest: {
          600: '#5E6C58',  // Forest Green
          500: '#4D5A47',
        },
        sky: {
          200: '#D6E0E2',  // Sky Blue
          100: '#E8EBED',
        },
        cream: {
          200: '#F4EFE0',  // Light Cream
          100: '#FEFCF6',  // Off-White
        },
        storm: {
          500: '#680867',  // Storm Cloud Gray (purple-ish)
          200: '#D6E0E2',  // Light Storm (same as sky)
        },
        // Semantic aliases for UI
        primary: {
          DEFAULT: '#162A2C',
          dark: '#2F4156',
        },
        accent: {
          teal: '#567CBD',
          green: '#5E6C58',
          sky: '#D6E0E2',
        },
        background: {
          DEFAULT: '#FEFCF6',
          card: '#F4EFE0',
        },
        text: {
          primary: '#162A2C',
          secondary: '#2F4156',
          muted: '#6B7B8A',
        },
        status: {
          success: '#2E7D32',
          warning: '#F57F17',
          danger: '#C62828',
          info: '#567CBD',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(22, 42, 44, 0.08)',
        'card-hover': '0 4px 16px rgba(22, 42, 44, 0.12)',
      },
    },
  },
  plugins: [],
}