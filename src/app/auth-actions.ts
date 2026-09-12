"use server";

import { signOut, auth } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}

export interface SessionInfo {
  email: string | null;
  name: string | null;
  authenticated: boolean;
}

export async function getSessionInfoAction(): Promise<SessionInfo> {
  const session = await auth();
  return {
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
    authenticated: Boolean(session?.user?.email),
  };
}
