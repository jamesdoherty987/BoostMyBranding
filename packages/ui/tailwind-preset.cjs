/** Shared Tailwind preset for all BoostMyBranding apps. */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#48D886',
          secondary: '#1D9CA1',
          accent: '#FFEC3D',
          ink: '#0B1220',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        brand: '0 10px 30px -10px rgba(72,216,134,0.35), 0 6px 18px -8px rgba(29,156,161,0.25)',
      },
    },
  },
  plugins: [],
};
