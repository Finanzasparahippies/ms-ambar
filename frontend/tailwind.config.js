const withAlpha = (variableName) => `rgb(var(${variableName}) / <alpha-value>)`;

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
        primary: withAlpha('--color-primary-rgb'),
        secondary: withAlpha('--color-secondary-rgb'),
        accent: withAlpha('--color-accent-rgb'),
        card: withAlpha('--color-card-rgb'),
        corporate: {
          purple: withAlpha('--color-purple-rgb'),
          honey: withAlpha('--color-honey-rgb'),
        },
        amber: {
          honey: withAlpha('--color-honey-rgb'),
          cognac: withAlpha('--color-accent-rgb'),
          cherry: '#700101',
          butterscotch: withAlpha('--color-secondary-rgb'),
        },
        nature: {
          sky: withAlpha('--color-secondary-rgb'),
          earth: '#8B4513',
          night: withAlpha('--color-bg-start-rgb'),
          stars: withAlpha('--color-text-rgb'),
        },
        forest: {
          green: withAlpha('--color-card-rgb'),
          muted: withAlpha('--color-bg-end-rgb'),
        }
      },
    },
  },
  plugins: [],
}
