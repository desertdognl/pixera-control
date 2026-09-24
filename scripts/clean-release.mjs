import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const dir = resolve('release')
if (!existsSync(dir)) {
  console.log('No release/ folder to clean')
  process.exit(0)
}

for (const name of readdirSync(dir)) {
  if (name === 'markers') continue
  rmSync(join(dir, name), { recursive: true, force: true })
}
console.log(`Cleared ${dir} (kept markers/)`)
