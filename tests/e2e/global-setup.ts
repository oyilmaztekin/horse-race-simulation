import { spawnSync } from 'node:child_process'

export default async function globalSetup(): Promise<void> {
  const result = spawnSync('npm', ['run', 'db:seed'], { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`db:seed failed with exit code ${result.status}`)
  }
}
