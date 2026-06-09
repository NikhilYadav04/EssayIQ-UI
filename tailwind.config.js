/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Academic Precision palette ──
        primary:   '#2563EB',   // Primary blue
        secondary: '#F59E0B',   // Secondary amber
        tertiary:  '#10B981',   // Tertiary green
        neutral:   '#64748B',   // Neutral slate

        ink:       '#1A2340',   // headline text
        body:      '#475569',   // body text
        muted:     '#8A96AA',   // muted labels
        line:      '#E2E8F0',   // hairline borders
        canvas:    '#EEF3FB',   // app background
        card:      '#FFFFFF',   // card surface
      },
      fontFamily: {
        display: ['"Hanken Grotesk"', 'sans-serif'],
        sans:    ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        xl:  '0.875rem',
        '2xl': '1.125rem',
      },
      spacing: {
        gutter: '24px',
        margin: '32px',
      },
    },
  },
  plugins: [],
}
