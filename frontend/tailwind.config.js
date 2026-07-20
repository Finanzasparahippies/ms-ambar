/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      colors: {
        amber: {
          honey: '#E5A93B', // Rich golden amber
          cognac: '#9F2B00',
          cherry: '#700101',
          butterscotch: '#F4D03F',
        },
        nature: {
          sky: '#22A6B3',
          earth: '#8B4513',
          night: '#0B0F0D', // Deep forest green-black
          stars: '#F5F6FA',
        },
        forest: {
          green: '#1E2B22', // Template dark green
          muted: '#2E3F33',
        }
      },
    },
  },
  plugins: [],
}
