import { prisma } from '@/lib/db/prisma'

/**
 * Ensures a `User` row exists for the signed-in Clerk account.
 * Workflow rows reference `User.id`; call this from authenticated API routes before writes.
 *
 * @param clerkId - `user_...` from Clerk `auth().userId`
 * @param email - Primary email (used for display / debugging)
 */
export async function ensureAppUser(clerkId: string, email: string) {
  return prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email },
    update: { email },
  })
}
