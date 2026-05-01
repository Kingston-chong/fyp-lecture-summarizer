import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid email or password.");
        }

        const emailNorm = normalizeEmail(credentials.email);
        const user = await prisma.user.findUnique({
          where: { email: emailNorm },
        });

        if (!user) {
          throw new Error("Invalid email or password.");
        }

        if (user.passwordHash === "google-oauth") {
          throw new Error(
            "This account is linked to Google sign-in. Please use the 'Continue with Google' button or reset your password first."
          );
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          throw new Error("Invalid email or password.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          if (!user?.email) return false;
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
          });

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

    async session({ session }) {
      if (!session?.user?.email) return session;

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
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

