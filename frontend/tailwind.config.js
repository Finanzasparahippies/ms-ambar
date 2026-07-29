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
        serif: ['var(--theme-heading-font)', '"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      colors: {
        primary: 'var(--primary-color, #E5A93B)',
        secondary: 'var(--secondary-color, #22A6B7)',
        accent: 'var(--accent-color, #9F2B00)',
        card: 'var(--card-bg, #0c0f0d)',
        amber: {
          honey: 'rgb(var(--amber-primary) / <alpha-value>)',
          cognac: 'var(--accent-color, #9F2B00)',
          cherry: '#700101',
          butterscotch: 'var(--secondary-color, #22A6B7)',
        },
        nature: {
          sky: 'rgb(var(--sky-accent) / <alpha-value>)',
          earth: '#8B4513',
          night: 'var(--background-start, #080c0a)',
          stars: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        },
        forest: {
          green: 'var(--card-bg, #0c0f0d)',
          muted: 'var(--background-end, #040605)',
        }
      },
    },
  },
  plugins: [],
}
