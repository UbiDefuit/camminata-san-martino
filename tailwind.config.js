/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './utils/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pine: {
          50: '#f2f8f3', 100: '#dfeee2', 200: '#c1dcc8', 300: '#96c2a3',
          400: '#68a27a', 500: '#47855c', 600: '#356a48', 700: '#2b553b',
          800: '#254431', 900: '#1f3929', 950: '#101f16'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      animation: { 'fade-in-up': 'fadeInUp 0.5s ease-out' },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
