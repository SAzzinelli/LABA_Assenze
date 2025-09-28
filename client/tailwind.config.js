/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{html,js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'gradient': 'gradient 3s ease infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        }
      }
    },
  },
  plugins: [],
  safelist: [
    // Safelist per classi dinamiche
    'bg-slate-700',
    'bg-slate-800',
    'bg-slate-900',
    'text-white',
    'text-slate-300',
    'text-slate-400',
    'border-slate-600',
    'border-slate-700',
    'hover:bg-slate-700',
    'hover:bg-slate-800',
    'focus:ring-indigo-500',
    'focus:border-transparent',
    'rounded-xl',
    'rounded-2xl',
    'rounded-3xl',
    'p-4',
    'p-6',
    'p-8',
    'py-3',
    'py-4',
    'px-4',
    'px-6',
    'transition-all',
    'duration-300',
    'shadow-lg',
    'shadow-xl',
    'glass',
    'glass-card',
    'animate-float',
    // Pattern per classi dinamiche
    { pattern: /(bg|text|border)-(slate|indigo|purple)-(100|200|300|400|500|600|700|800|900)/ },
    { pattern: /(hover|focus):(bg|text|border)-(slate|indigo|purple)-(100|200|300|400|500|600|700|800|900)/ },
    { pattern: /(rounded|p|py|px|m|my|mx|w|h)-(xs|sm|md|lg|xl|2xl|3xl)/ },
  ],
}
