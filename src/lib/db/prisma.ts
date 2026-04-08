import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

/**
 * Reuse one Prisma client in dev to avoid exhausting connections on hot reload.
 * In production, Vercel serverless still benefits from module-level singleton per isolate.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn('DATABASE_URL is not set. PrismaClient will not be functional.')
    return new Proxy({} as any, {
      get(target, prop) {
        if (prop === 'then') return undefined
        return new Proxy({}, {
          get(innerTarget, innerProp) {
            if (innerProp === 'then') return undefined
            return () => {
              throw new Error(`DATABASE_URL is not set. Cannot access prisma.${String(prop)}.${String(innerProp)}`)
            }
          }
        })
      }
    })
  }
  const adapter = new PrismaNeon({ connectionString: url })
  return new PrismaClient({ adapter })
}

/** Shared Prisma client for server-side code (API routes, server actions, Trigger tasks). */
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
