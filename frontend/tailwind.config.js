/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', ...defaultTheme.fontFamily.sans]
      },
      colors: {
        backdrop: '#0C1016',
        backdropCard: '#12181E',
        stroke: '#1F2A33',
        accent: '#13EA5A',
        textPrimary: '#E9EEF3',
        textSecondary: '#9AA6B2',
        mutedChip: '#0F141B',
        successBg: '#0F2A18',
        successText: '#13EA5A',
        neutralBg: '#1A222B',
        neutralText: '#AAB4BF'
      },
      boxShadow: {
        glow: '0 20px 45px rgba(6,13,21,0.45)'
      }
    }
  },
  plugins: []
}
