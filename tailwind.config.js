/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#fffaf2',
        sand: '#1d2636',
        acid: '#6366F1',
        primary: '#4F46E5',
        blood: '#B91C1C',
        sky: '#0EA5E9',
        moss: '#15803D',
        warning: '#B45309',
        l1: '#ffffff',
        l2: '#f4f1ea',
        l3: '#d8d0c4',
      },
      fontFamily: {
        display: ['Oswald', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        loud: '0 24px 70px rgba(75, 70, 59, 0.18)',
        card: '0 2px 10px rgba(75, 70, 59, 0.08), inset 0 1px 0 rgba(255,255,255,0.75)',
        elevated: '0 12px 36px rgba(75, 70, 59, 0.14), inset 0 1px 0 rgba(255,255,255,0.8)',
        glow: '0 12px 26px rgba(79,70,229,0.22), 0 4px 12px rgba(75,70,59,0.12)',
        ring: '0 0 0 3px rgba(99,102,241,0.4)',
      },
      keyframes: {
        pulsein: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.03)', opacity: '0.85' },
        },
        floatup: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        pulsein: 'pulsein 1.2s ease-in-out infinite',
        floatup: 'floatup 0.5s ease-out',
      },
    },
  },
  plugins: [],
}
