import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#efe7d8',
        sandlt: '#f6f1e7',
        sanddk: '#e6dcc9',
        line: '#e0d6c2',
        terra: '#c4633f',
        terradk: '#a64f30',
        terraxd: '#8a4127',
        ink: '#2b251d',
        inkmut: '#6b6253',
      },
      boxShadow: {
        card: '0 1px 2px rgba(43,37,29,.04), 0 12px 32px -12px rgba(43,37,29,.18)',
        soft: '0 1px 2px rgba(43,37,29,.05), 0 6px 18px -10px rgba(43,37,29,.14)',
        btn: '0 8px 20px -6px rgba(196,99,63,.5)',
      },
      fontFamily: { sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'] },
      maxWidth: { page: '1180px' },
    },
  },
  plugins: [],
}
export default config
