// Initial JS of a first visit = the entry chunk plus everything it imports statically
// (transitively), gzipped. Lazy chunks (routes, sheets, charts, motion features) do not count.
// Fails above the budget from docs/PLAN.md (Phase 6: < 250 KB gzip). Run after `npm run build`.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = 250
const dist = new URL('../dist/', import.meta.url)
const html = readFileSync(new URL('index.html', dist), 'utf8')
const entry = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/)?.[1]
if (!entry) throw new Error('No entry script in dist/index.html – run `npm run build` first.')

const seen = new Set()
const visit = (file) => {
  if (seen.has(file)) return
  seen.add(file)
  const code = readFileSync(new URL(`assets/${file}`, dist), 'utf8')
  // Static imports only (`import … from "./x.js"`, `import "./x.js"`), not `import("./x.js")`.
  for (const match of code.matchAll(
    /(?:^|[;\s}])import\s*(?:[^"'()]*?from\s*)?["']\.\/([^"']+\.js)["']/g,
  )) {
    visit(match[1])
  }
}
visit(entry)

const sizes = [...seen].map((file) => ({
  file,
  kb: gzipSync(readFileSync(new URL(`assets/${file}`, dist))).length / 1024,
}))
const total = sizes.reduce((sum, { kb }) => sum + kb, 0)
for (const { file, kb } of sizes.sort((a, b) => b.kb - a.kb)) {
  console.log(`${kb.toFixed(1).padStart(7)} KB  ${file}`)
}
console.log(`Initial JS: ${total.toFixed(1)} KB gzip (budget ${BUDGET_KB} KB)`)
if (total > BUDGET_KB) {
  console.error('Over budget – something pulled a lazy module into the start chunk.')
  process.exit(1)
}
