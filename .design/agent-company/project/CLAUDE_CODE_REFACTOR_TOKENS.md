# Claude Code · Refactor brief · Token-ize the UI (no new features)

**Status:** Refactor only. Do not introduce new screens, features, or behavior.
**Goal:** Make future theme changes (light/dark/anything) cheap — single-token edits, not per-file find-replace.

---

## What to change

Right now `src/App.tsx` (and anywhere else) has hardcoded color values inline, e.g.:

```tsx
<div style={{ background: '#202225', color: 'white' }}>
<div style={{ background: '#5865f2', borderRadius: '16px' }}>
<button style={{ background: '#23a559', color: 'white' }}>
```

After this refactor, no component should contain a literal hex color, OKLCH value, or named color in `style={{}}` props (except the special cases listed in §4 below).

## How to do it

### 1 · Set up Tailwind theme tokens

In `tailwind.config.js`, define semantic tokens (not Discord-named ones). Pattern:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Surfaces — bottom up
        surface: {
          0: 'var(--surface-0)',   // app background / rail
          1: 'var(--surface-1)',   // middle column / sidebar
          2: 'var(--surface-2)',   // main panel
          3: 'var(--surface-3)',   // cards on the main panel
        },
        // Ink (text)
        ink: {
          DEFAULT: 'var(--ink)',
          muted:   'var(--ink-muted)',
          subtle:  'var(--ink-subtle)',
        },
        // Roles
        pm:      { DEFAULT: 'var(--pm)',      soft: 'var(--pm-soft)' },
        worker:  { DEFAULT: 'var(--worker)',  soft: 'var(--worker-soft)' },
        review:  { DEFAULT: 'var(--review)',  soft: 'var(--review-soft)' },
        approve: { DEFAULT: 'var(--approve)', soft: 'var(--approve-soft)' },
        warn:    { DEFAULT: 'var(--warn)',    soft: 'var(--warn-soft)' },
        // Borders
        rule:       'var(--rule)',
        'rule-soft':'var(--rule-soft)',
      },
      borderRadius: {
        card: 'var(--radius-card)',     // 4-5px
        pill: 'var(--radius-pill)',     // 999px
        soft: 'var(--radius-soft)',     // 10px
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
};
```

### 2 · Define the actual values in CSS variables

In `src/index.css`:

```css
:root {
  /* Light theme — provisional values. Linzhi will tune these. */
  --surface-0: #f3efe5;
  --surface-1: #faf7f0;
  --surface-2: #ffffff;
  --surface-3: #fbfaf6;

  --ink:        #1f1d1a;
  --ink-muted:  #5a5750;
  --ink-subtle: #948f84;

  --pm:      #3b6aa8;  --pm-soft:      #d9e4f2;
  --worker:  #6b4e7f;  --worker-soft:  #e6dded;
  --review:  #c97a3a;  --review-soft:  #f4dfc6;
  --approve: #4a7c4a;  --approve-soft: #d5e6cf;
  --warn:    #c9554a;  --warn-soft:    #f6d8d4;

  --rule:      rgba(31,29,26,0.85);
  --rule-soft: rgba(31,29,26,0.35);

  --radius-card: 5px;
  --radius-pill: 999px;
  --radius-soft: 10px;
}

/* Dark theme stub — keep but don't tune yet. Linzhi will return to this. */
[data-theme="dark"] {
  --surface-0: #1a1816;
  --surface-1: #232220;
  --surface-2: #2a2825;
  --surface-3: #312f2c;
  --ink:        #f0ece4;
  --ink-muted:  #b5b0a5;
  --ink-subtle: #7a766f;
  /* role + rule tokens: leave for later */
}
```

Note: theme switching infrastructure is **out of scope for this refactor**. Just leave the `[data-theme="dark"]` block as a stub so future activation is one attribute flip.

### 3 · Sweep components

Go file by file. For each color reference:

- `'#5865f2'` (Discord blue) → use `bg-pm` / `text-pm` (or `var(--pm)` if you must use a style prop)
- `'#23a559'` (green) → `bg-approve` / `text-approve`
- `'#f23f43'` (red) → `bg-warn` / `text-warn`
- `'#f1c40f'` (yellow, used for HITL) → `bg-review` / `text-review` (review = HITL prompt color)
- `'#202225'`, `'#2b2d31'`, `'#313338'` (Discord surfaces) → `bg-surface-0` / `bg-surface-1` / `bg-surface-2`
- `'#dbdee1'`, `'#b5bac1'`, `'#949ba4'` (Discord ink) → `text-ink` / `text-ink-muted` / `text-ink-subtle`
- `'white'`, `'#fff'` → `text-ink` (NOT a literal white — text color is theme-dependent)

When unsure which token to use, look at the **role** of the element, not its current color. A "Worker is running" indicator is `approve` (green semantic), not "the green color." A pending action is `review` (orange semantic), regardless of whether it ends up yellow, orange, or red in a given theme.

### 4 · What to leave as literals

- Pure transparent / black scrim overlays (`rgba(0,0,0,0.5)`) — these are not theme-dependent
- Box-shadow values that are intentionally translucent dark (`0 4px 12px rgba(0,0,0,0.1)`)
- SVG fills inside lucide icons (they inherit `currentColor` already — don't touch)

If you find yourself adding a token for a one-off color, **stop** — that's a smell. Either reuse an existing token or flag it for Linzhi.

### 5 · Migrate inline styles to Tailwind className where the change is mechanical

You don't have to rewrite every component. But where a `style={{...}}` is purely setting `background`, `color`, `borderColor`, `borderRadius`, or `fontFamily` from one of the tokens above, it's almost always shorter and clearer to use `className=""` with the Tailwind utility. Use your judgment.

Where the `style` prop is doing layout (`flex`, `position`, `display: grid`, dynamic widths), **leave it alone** — that's not what this refactor is about.

---

## Acceptance criteria

When you're done:

1. `grep -r '#[0-9a-fA-F]\{3,6\}' src/` returns only the special cases in §4 (or zero).
2. App looks the same as before — this is purely a refactor.
3. Flipping `document.documentElement.dataset.theme = 'dark'` in the console changes all surface and ink colors (won't be polished, but the system works).
4. No new dependencies added.

## Out of scope — do NOT do these

- Don't add a settings UI for theme picking yet.
- Don't add a dark-mode toggle button.
- Don't tune the dark theme values — just leave the stub.
- Don't change the Discord rail / 3-column layout — that's the next conversation.
- Don't rename Session→Mission or CEO→PM yet — that's its own focused refactor.

When this is done, ping Linzhi. The next thing will either be:
- a layout refactor based on updated wireframes, or
- a vocabulary rename pass (Session → Mission, CEO → PM, etc.)

She'll tell you which.
