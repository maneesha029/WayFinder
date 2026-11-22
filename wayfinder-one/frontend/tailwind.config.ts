import type { Config } from 'tailwindcss';

/**
 * Colours come from CSS variables in src/styles/tokens.css (A5 design direction),
 * so the palette can be themed without touching utilities.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        brand: 'var(--brand)',
        'brand-strong': 'var(--brand-strong)',
        'brand-ink': 'var(--brand-ink)',
        'brand-soft': 'var(--brand-soft)',
        green: 'var(--green)',
        'green-bg': 'var(--green-bg)',
        amber: 'var(--amber)',
        'amber-bg': 'var(--amber-bg)',
        red: 'var(--red)',
        'red-bg': 'var(--red-bg)',
        sim: 'var(--sim)',
        'sim-bg': 'var(--sim-bg)',
        'accent-flight': 'var(--accent-flight)',
        'accent-transfer': 'var(--accent-transfer)',
        'accent-hotel': 'var(--accent-hotel)',
        'accent-activity': 'var(--accent-activity)'
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.25rem', { lineHeight: '1.4' }],
        xl: ['1.75rem', { lineHeight: '1.3' }],
        '2xl': ['1.75rem', { lineHeight: '1.2' }],
        '3xl': ['2.5rem', { lineHeight: '1.2' }]
      },
      borderRadius: {
        card: '12px',
        inset: '8px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,24,31,0.06), 0 6px 20px rgba(20,24,31,0.05)',
        pop: '0 4px 12px rgba(20,24,31,0.10), 0 16px 40px rgba(20,24,31,0.12)'
      },
      maxWidth: {
        content: '1280px'
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    }
  },
  plugins: []
};
export default config;
