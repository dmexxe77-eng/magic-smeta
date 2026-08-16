/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ─── Theme tokens via CSS vars (set via vars() per theme) ─────
        bg:            'var(--bg)',
        bg2:           'var(--bg2)',
        card:          'var(--card)',
        surface2:      'var(--surface2)',
        border:        'var(--border)',
        borderStrong:  'var(--border-strong)',

        ink:           'var(--ink)',
        muted:         'var(--muted)',
        "ink-subtle":  'var(--subtle)',
        "ink-faint":   'var(--faint)',

        accent:        'var(--accent)',
        "accent-ink":  'var(--accent-ink)',
        "accent-soft": 'var(--accent-soft)',
        "accent-light":'var(--accent-soft)',
        "accent-mid":  'var(--accent-bright)',

        // Legacy aliases used in older code paths
        navy:          'var(--ink)',
        navy2:         'var(--bg2)',

        success:       'var(--success)',
        warning:       'var(--warning)',
        danger:        'var(--danger)',
        info:          'var(--info)',
      },
      fontFamily: {
        sans:  ['System', 'sans-serif'],
        mono:  ['Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
