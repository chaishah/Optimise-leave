/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0f',
        sand: '#f0ede8',
        acid: '#00BD7D',
        primary: '#00BD7D',
        blood: '#DC2626',
        sky: '#60B9F0',
        moss: '#16A34A',
        warning: '#D97706',
        l1: '#111118',
        l2: '#0d0d14',
        l3: '#1e1e2a',
      },
      fontFamily: {
        display: ['Oswald', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        loud: '0 20px 60px rgba(0,0,0,0.5)',
        card: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        elevated: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        glow: '0 0 24px rgba(0,189,125,0.3), 0 4px 12px rgba(0,0,0,0.3)',
        ring: '0 0 0 3px rgba(0,189,125,0.4)',
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
