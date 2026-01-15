/**
 * Express Request Type Augmentation
 * Extends Express Request interface with validated data and user properties
 */

import type { User as SchemaUser, UserPreferences } from "@shared/schema";

// Safe user type (without passwordHash)
export type SafeUser = Omit<SchemaUser, "passwordHash">;

// Authenticated request user (matches DB schema, nullable fields)
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  passwordHash?: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "admin" | "sales" | "cs" | "support" | null;
  organizationId: number | null;
  profileImageUrl: string | null;
  preferences: UserPreferences | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// Augment Passport's User type
declare global {
  namespace Express {
    // Override Passport's User interface to match DB schema
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}

    // Augment the Express Request interface
    interface Request {
      // Added by requestIdMiddleware
      requestId?: string;

      // Validated request data (set by validate* middlewares)
      // Note: Using 'any' here to allow flexible access after validation
      // The actual type safety comes from the Zod schema validation at runtime
      validatedBody?: any;
      validatedQuery?: any;
      validatedParams?: any;
    }
  }
}

// Re-export for use in other modules
export type { AuthenticatedUser as RequestUser };
