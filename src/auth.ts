import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { canSignIn, parseAllowlist } from "@/lib/auth-config";

/**
 * Google sign-in, restricted to an allowlist.
 *
 * Auth configuration lives in environment variables rather than the encrypted
 * credential store on purpose: credentials needed to log in cannot themselves
 * sit behind the login. If the database is unreachable or APP_SECRET changes,
 * you would otherwise be locked out permanently.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Always show the account chooser, so a shared machine cannot silently
      // reuse whichever Google account happens to be signed in.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],

  pages: {
    signIn: "/signin",
    error: "/signin",
  },

  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // a working day
  },

  callbacks: {
    async signIn({ profile }) {
      const allowlist = parseAllowlist(process.env.AUTH_ALLOWED_EMAILS);
      const decision = canSignIn(
        profile?.email,
        Boolean(profile?.email_verified),
        allowlist
      );

      if (!decision.allowed) {
        console.warn(`Sign-in refused: ${decision.reason}`);
        return "/access-denied";
      }
      return true;
    },

    async jwt({ token, profile }) {
      if (profile?.email) {
        token.email = profile.email.toLowerCase();
        token.name = profile.name ?? token.name;
        token.picture = profile.picture ?? token.picture;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },

  trustHost: true,
});
