/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        amber: {
          honey: '#FFBF00',
          cognac: '#9F2B00',
          cherry: '#700101',
          butterscotch: '#F4D03F',
        },
        nature: {
          sky: '#22A6B3',
          earth: '#8B4513',
          night: '#0B0D17',
          stars: '#F5F6FA',
        },
      },
    },
  },
  plugins: [],
}
