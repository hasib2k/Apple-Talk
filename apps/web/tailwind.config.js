/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mango: {
          50:  '#f1f8e9',
          100: '#dcedc8',
          200: '#c5e1a5',
          300: '#aed581',
          400: '#9ccc65',
          500: '#8bc34a',
          600: '#7cb342',
          700: '#689f38',
          800: '#558b2f',
          900: '#33691e',
        },
        skin: {
          50: '#fffbeb',
          100: '#fff3c4',
          200: '#ffe688',
          300: '#ffd24d',
          400: '#ffbf27',
          500: '#f59e0b',
          600: '#d97706',
        },
        leaf: {
          50:  '#f0f7f3',
          100: '#d6ece0',
          200: '#aed9c2',
          300: '#7bbf9e',
          400: '#4a9f78',
          500: '#1f5c3d',
          600: '#174d32',
          700: '#113d27',
          800: '#0c2e1d',
          900: '#071f13',
        },
      },
      fontFamily: {
        sans: ['Kanit', 'system-ui', 'sans-serif'],
        display: ['Oxanium', 'sans-serif'],
      },
      animation: {
        'ripple': 'ripple 2s ease-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(1)', opacity: '0.4' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateX(-50%) translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateX(-50%) translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
