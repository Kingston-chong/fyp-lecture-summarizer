import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

// const prisma = new PrismaClient();

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account.provider === "google") {
        try {
          // Check if user already exists
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
          });

          // If not, create them automatically
          if (!existing) {
            await prisma.user.create({
              data: {
                email: user.email,
                username: user.name.replace(/\s+/g, "").toLowerCase(),
                passwordHash: "google-oauth",
                role: "Student",
              },
            });
          }
          return true;
        } catch (err) {
          console.error(err);
          return false;
        }
      }
      return true;
    },

    async session({ session, token }) {
      // Attach user info to session
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.username = dbUser.username;
        session.user.role = dbUser.role;
      }
      return session;
    },
  },

  pages: {
    signIn: "/", // redirect to your login page
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };