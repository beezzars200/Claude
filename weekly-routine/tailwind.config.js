/** @type {import('tailwindcss').Config} */
module.exports = {
  // app.js holds its class names as complete literal strings (never built up by
  // concatenation) precisely so Tailwind's scanner can find them here.
  content: ['./index.html', './app.js', './schedule.js'],
  darkMode: 'media',
  theme: {
    extend: {},
  },
  plugins: [],
};
