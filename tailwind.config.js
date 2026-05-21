/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 30px rgba(124, 58, 237, 0.18)',
      },
      colors: {
        brand: {
          950: '#090624',
          900: '#111827',
          800: '#1e293b',
        },
      },
    },
  },
  plugins: [],
};

