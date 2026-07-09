import NextAuth, { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Neo4jAdapter } from "@auth/neo4j-adapter";
import neo4j from "neo4j-driver";

const driver = neo4j.driver(
  process.env.NEO4J_URI || "bolt://neo4j:7687",
  neo4j.auth.basic(
    process.env.NEO4J_USER || "neo4j",
    process.env.NEO4J_PASSWORD || "localpassword",
  ),
  {
    encrypted: false,
    trust: "TRUST_ALL_CERTIFICATES",
  },
);

const neo4jSession = driver.session();

export const authOptions: NextAuthOptions = {
  adapter: Neo4jAdapter(neo4jSession),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST || "localhost",
        port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
        secure: false, // Mailhog doesn't use TLS
        auth: process.env.EMAIL_SERVER_USER
          ? {
              user: process.env.EMAIL_SERVER_USER,
              pass: process.env.EMAIL_SERVER_PASSWORD || "",
            }
          : undefined, // No auth for Mailhog
      },
      from: process.env.EMAIL_FROM || "noreply@localhost",
      maxAge: 10 * 60, // 10 minutes expiration for magic links
    }),
  ],
  session: {
    strategy: "jwt", // Use JWT sessions to provide accessToken
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    newUser: "/auth/setup",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        // For simplicity, just pass the user ID as the access token
        // The backend will validate this approach differently
        session.accessToken = token.id as string;
      }
      return session;
    },
    async signIn({ user, account, profile, email, credentials }) {
      // Allow all email sign-ins for now
      // TODO: Add rate limiting and validation here
      return true;
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // TODO: Add audit logging here
      console.log(`User signed in: ${user.email} (newUser: ${isNewUser})`);
    },
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
