/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0e0e12',
        sand: '#f6f0e9',
        acid: '#d7ff3f',
        blood: '#ff3f6e',
        sky: '#66d1ff',
        moss: '#74c69d'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        loud: '0 20px 60px rgba(0,0,0,0.25)',
        ring: '0 0 0 6px rgba(215,255,63,0.55)'
      },
      keyframes: {
        pulsein: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.03)', opacity: '0.85' }
        },
        floatup: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      animation: {
        pulsein: 'pulsein 1.2s ease-in-out infinite',
        floatup: 'floatup 0.6s ease-out'
      }
    }
  },
  plugins: []
}
