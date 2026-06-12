export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2874F0',
          50: '#EBF3FF',
          100: '#D6E6FF',
          600: '#1E5BC6',
          700: '#174A9E',
        },
        cta: {
          DEFAULT: '#FB641B',
          dark: '#E55510',
        },
        discount: '#FF6161',
        bg: '#F1F3F6',
        surface: '#FFFFFF',
        ink: '#212121',
        muted: '#878787',
        success: {
          DEFAULT: '#388E3C',
          light: '#EBFAF0',
        },
        adminBg: '#0F0F1A',
        adminSurf: '#1A1A2E',
        adminBorder: '#2A2A3E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)',
        cardHover: '0 8px 24px rgba(0,0,0,0.08)',
      },
      animation: {
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      // Safe area padding for iPhone notch / home indicator
      padding: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      height: {
        'screen-safe': 'calc(100svh)',
      },
    },
  },
  plugins: [],
}