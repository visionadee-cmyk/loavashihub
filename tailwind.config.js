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
        // Override slate palette to a light-first palette so existing
        // classes like bg-slate-950 become light backgrounds.
        slate: {
          50: '#020617',
          100: '#0f172a',
          200: '#1f2937',
          300: '#334155',
          400: '#475569',
          500: '#64748b',
          600: '#94a3b8',
          700: '#cbd5e1',
          800: '#e2e8f0',
          900: '#f1f5f9',
          950: '#ffffff',
        },
      },
    },
  },
  plugins: [],
};

