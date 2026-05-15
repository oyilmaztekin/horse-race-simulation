export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_PORT = 3001

export interface BindConfig {
  host: string
  port: number
}

export function resolveBindConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): BindConfig {
  const host = env.HOST && env.HOST.length > 0 ? env.HOST : DEFAULT_HOST
  if (env.PORT === undefined) return { host, port: DEFAULT_PORT }
  const parsed = Number(env.PORT)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`PORT must be a positive integer, got: ${env.PORT}`)
  }
  return { host, port: parsed }
}
