// Run after every `npx shadcn add …`: generated components import the bare "cn" package,
// which does not know our custom font sizes. Point them at the configured merger instead.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'src/shared/ui'
const changed = []

for (const file of readdirSync(dir)) {
  if (!/\.tsx?$/.test(file)) continue
  const path = join(dir, file)
  const source = readFileSync(path, 'utf8')
  const next = source.replace(/from ["']cn["']/g, 'from "@/shared/lib/utils"')
  if (next !== source) {
    writeFileSync(path, next)
    changed.push(file)
  }
}

console.log(
  changed.length
    ? `Rewrote cn import in: ${changed.join(', ')}`
    : 'All ui components already use the configured cn.',
)
