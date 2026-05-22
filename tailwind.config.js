/** @type {import('tailwindcss').Config} */
const brandWhite = '#ffffff';
const brandNavy = '#05093f';
const brandBrown = '#7c4b2e';

const brandScale = {
  50: brandWhite,
  100: brandWhite,
  200: brandBrown,
  300: brandBrown,
  400: brandNavy,
  500: brandNavy,
  600: brandNavy,
  700: brandNavy,
  800: brandNavy,
  900: brandNavy,
  950: brandNavy,
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: brandWhite,
      black: brandNavy,
      slate: brandScale,
      amber: brandScale,
      emerald: brandScale,
      violet: brandScale,
      orange: brandScale,
      rose: brandScale,
      red: brandScale,
      green: brandScale,
      yellow: brandScale,
      cyan: brandScale,
      teal: brandScale,
      sky: brandScale,
      indigo: brandScale,
      pink: brandScale,
      fuchsia: brandScale,
      stone: brandScale,
      neutral: brandScale,
      zinc: brandScale,
    },
    extend: {
      boxShadow: {
        glow: '0 0 30px rgba(124, 58, 237, 0.18)',
      },
    },
  },
  plugins: [],
};

