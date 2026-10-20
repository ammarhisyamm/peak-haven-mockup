/**
 * MOQZUNO theme. The UI was written with Tailwind's light slate/white/emerald classes; this config
 * remaps them onto the brand's dark palette (Midnight Ink surfaces, Soft Canvas text, Electric Lime
 * accents) so every component follows the brand without per-class rewrites.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"DM Sans"', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        white: '#151529',
        slate: {
          50: '#1c1c36',
          100: '#23233f',
          200: '#2e2e50',
          300: '#3d3d63',
          400: '#717196',
          500: '#9696b6',
          600: '#b7b7cf',
          700: '#d6d6e4',
          800: '#ebe9ef',
          900: '#f5f3ee',
          950: '#ffffff',
        },
        emerald: {
          50: '#2a3518',
          100: '#34431c',
          300: '#b4e64f',
          400: '#d4ff7a',
          500: '#caff5c',
          600: '#caff5c',
          700: '#caff5c',
        },
        brand: {
          lime: '#caff5c',
          ink: '#151529',
          deep: '#0d0d1d',
          violet: '#7657ff',
          canvas: '#f5f3ee',
          coral: '#ff7868',
          pure: '#ffffff',
        },
      },
    },
  },
  plugins: [],
};
