import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    /** Neon: non-pooled URL for migrations and CLI (see Neon docs). */
    url: env('DIRECT_URL'),
  },
})
