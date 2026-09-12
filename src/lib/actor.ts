import { auth } from "@/auth";

/**
 * Who to record against a change.
 *
 * Every audit row used to say "owner", which made the trail useless the moment
 * more than one person could touch the data. It now names the signed-in account.
 *
 * Falls back to "system" for work with no session — schema bootstrap, seeding,
 * or a future scheduled job — so the trail never silently attributes an
 * automated change to a person.
 */
export async function currentActor(): Promise<string> {
  try {
    const session = await auth();
    return session?.user?.email ?? "system";
  } catch {
    // auth() throws outside a request context, e.g. during table creation.
    return "system";
  }
}
