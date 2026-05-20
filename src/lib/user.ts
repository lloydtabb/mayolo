import { db, users, type User } from "@/db";
import { newUserSlug } from "./slug";

// v0: single tenant, no auth. Auto-create / fetch the singleton user.
// On the rare slug collision (~525k namespace), retry — Postgres unique
// constraint on users.slug bounces the duplicate.
export async function getDefaultUser(): Promise<User> {
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) return existing[0];

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [created] = await db
        .insert(users)
        .values({ slug: newUserSlug() })
        .returning();
      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/users_slug_unique|duplicate key/i.test(msg) || attempt === 4) throw err;
    }
  }
  throw new Error("unreachable");
}
