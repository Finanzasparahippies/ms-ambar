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
      // Escala Tipográfica Estricta en rem (1rem = 16px base)
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],     // 12px / 16px
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],  // 14px / 20px
        'base': ['1rem',     { lineHeight: '1.5rem' }],   // 16px / 24px
        'lg':   ['1.125rem', { lineHeight: '1.75rem' }],  // 18px / 28px
        'xl':   ['1.25rem',  { lineHeight: '1.75rem' }],  // 20px / 28px
        '2xl':  ['1.5rem',   { lineHeight: '2rem' }],     // 24px / 32px
        '3xl':  ['1.875rem', { lineHeight: '2.25rem' }],  // 30px / 36px
        '4xl':  ['2.25rem',  { lineHeight: '2.5rem' }],   // 36px / 40px
      },
      // Micro-UI en px (bordes y divisores estrictos)
      borderWidth: {
        DEFAULT: '1px',
        '0': '0',
        '1': '1px',
        '2': '2px',
      },
      // Contenedores estructurales en rem
      maxWidth: {
        'prose': '65ch',
        'screen-sm': '40rem',   // 640px
        'screen-md': '48rem',   // 768px
        'screen-lg': '64rem',   // 1024px
        'screen-xl': '80rem',   // 1280px
      }
    },
  },
  plugins: [],
}
