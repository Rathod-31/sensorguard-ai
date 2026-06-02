/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          deepest: '#05080F',
          main: '#0A0E1A',
          card: '#0F1629'
        },
        accent: '#00D4FF',
        success: '#00E676',
        warning: '#FFB347',
        danger: '#FF4B4B',
        purple: '#A855F7',
        border: '#1E2D4A'
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
