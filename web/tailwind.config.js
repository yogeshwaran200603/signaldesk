/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Octa-inspired deep space navy palette
        background: 'var(--bg-base)',
        surface: 'var(--bg-card)',
        surfaceElevated: 'var(--bg-raised)',
        surfaceHover: 'var(--bg-hover)',
        border: 'var(--border-subtle)',
        borderStrong: 'var(--border-strong)',

        // Octa vibrant blue action accent
        brand: {
          blue: '#1F5BFF',
          blueHover: '#1848cc',
          blueGlow: 'rgba(31, 91, 255, 0.2)',
          blueSoft: 'rgba(31, 91, 255, 0.08)',
          dark: '#060A14',
          navy: '#0A0F1D',
          surface: '#0E1422',
          surfaceElevated: '#151C2E',
          surfaceHover: '#1C253D',
          border: 'rgba(255, 255, 255, 0.08)',
          borderSubtle: 'rgba(255, 255, 255, 0.05)',
          // Backward compatibility mappings
          teal: '#2F6BFF',
          tealGlow: 'rgba(47, 107, 255, 0.25)',
          amber: '#F59E0B',
          amberWarm: '#FBBF24',
          sky: '#38BDF8',
          rose: '#EA3943',
        },
        primary: {
          DEFAULT: '#2F6BFF',
          hover: '#1E58E6',
          foreground: '#FFFFFF',
        },
        // Strict market semantics
        success: {
          DEFAULT: '#16C784',
          hover: '#12A86E',
          soft: 'rgba(22, 199, 132, 0.12)',
          border: 'rgba(22, 199, 132, 0.3)',
        },
        danger: {
          DEFAULT: '#EA3943',
          hover: '#D32A34',
          soft: 'rgba(234, 57, 67, 0.12)',
          border: 'rgba(234, 57, 67, 0.3)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          soft: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.9rem' }], // 11px
        xs: ['0.75rem', { lineHeight: '1rem' }],        // 12px
        sm: ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
        base: ['1rem', { lineHeight: '1.5rem' }],       // 16px
        lg: ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }],     // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
        '3xl': ['1.75rem', { lineHeight: '2.25rem' }],  // 28px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
        '5xl': ['2.5rem', { lineHeight: '1.1' }],       // 40px
      },
      borderRadius: {
        xl: '0.75rem',   // 12px
        '2xl': '1rem',    // 16px
        '3xl': '1.5rem',  // 24px
        '4xl': '2rem',    // 32px
      },
      boxShadow: {
        'glow-blue': '0 0 35px -5px rgba(47, 107, 255, 0.3)',
        'glow-blue-sm': '0 0 18px -3px rgba(47, 107, 255, 0.25)',
        'glow-green': '0 0 30px -5px rgba(22, 199, 132, 0.25)',
        'glow-red': '0 0 30px -5px rgba(234, 57, 67, 0.25)',
        'glow-amber': '0 0 30px -5px rgba(245, 158, 11, 0.25)',
        'octa-card': '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        'octa-elevated': '0 12px 36px -4px rgba(0, 0, 0, 0.65)',
      },
      transitionDuration: {
        150: '150ms',
        200: '200ms',
        250: '250ms',
      },
      transitionTimingFunction: {
        octa: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
