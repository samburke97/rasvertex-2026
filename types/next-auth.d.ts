import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      globalRole: string;
      isVerified: boolean;
      isActive: boolean;
      status: string;
      hasBusinessConnection: boolean;
      isProfileComplete: boolean;
      firstName?: string;
      lastName?: string;
      lastJourneyRefresh?: number;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    globalRole: string;
    isVerified: boolean;
    isActive: boolean;
    status: string;
    hasBusinessConnection?: boolean;
    isProfileComplete?: boolean;
    firstName?: string;
    lastName?: string;
    phone?: string;
    dateOfBirth?: Date;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    globalRole: string;
    isVerified: boolean;
    isActive: boolean;
    status: string;
    hasBusinessConnection: boolean;
    isProfileComplete: boolean;
    lastRefresh: number;
  }
}
