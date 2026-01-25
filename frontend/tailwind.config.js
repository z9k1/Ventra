/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', ...defaultTheme.fontFamily.sans]
      },
      colors: {
        background: 'var(--background)',
        card: 'var(--card)',
        border: 'var(--border)',
        foreground: 'var(--foreground)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        'chip-muted': 'var(--chip-muted)',
        success: 'var(--success-bg)',
        'success-foreground': 'var(--success-fg)',
        neutral: 'var(--neutral-bg)',
        'neutral-foreground': 'var(--neutral-fg)'
      },
      boxShadow: {
        glow: '0 20px 45px rgba(6,13,21,0.45)'
      }
    }
  },
  plugins: []
}
