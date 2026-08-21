/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: "#05070c",
          card: "#0b0f19",
          border: "#1a233a",
          cyan: "#00f0ff",
          emerald: "#00ff9d",
          crimson: "#ff2a6d",
          amber: "#ffb703",
          purple: "#7000ff"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Orbitron"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif']
      }
    },
  },
  plugins: [],
}
