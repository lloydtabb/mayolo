import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, users, accounts, sessions, verificationTokens } from "@/db";
import { newUserSlug } from "@/lib/slug";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "database" },
  // Vercel preview deploys use dynamic hostnames; trust the request host.
  trustHost: true,
  events: {
    // Assign a friendly slug on first sign-in. Retry on the rare
    // unique-constraint collision (~525k namespace).
    async createUser({ user }) {
      if (!user.id) return;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await db
            .update(users)
            .set({ slug: newUserSlug() })
            .where(eq(users.id, user.id));
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/users_slug_unique|duplicate key/i.test(msg) || attempt === 4) {
            throw err;
          }
        }
      }
    },
  },
});
