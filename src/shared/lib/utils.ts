import { createCn } from 'cn/config'

/**
 * Class-name merger that knows our custom font sizes from src/styles/index.css.
 * Without this, `cn('text-label', 'text-fg-muted')` treats `text-label` as a color and drops it.
 * Keep the list in sync with the `--text-*` tokens. Everything (including generated shadcn
 * components) must import `cn` from here – importing the bare "cn" package is lint-banned.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'body', 'label', 'caption'] }],
    },
  },
})
