import type { Express } from "express";
import { isAuthenticated, requireRole } from "../../auth";
import { asyncHandler } from "../../middleware";
import { sendSuccess } from "../../response";

export function registerLgpdConsentRoutes(app: Express) {
  /**
   * List data processing consents (placeholder for future implementation)
   * GET /api/lgpd/consents
   */
  app.get(
    "/api/lgpd/consents",
    isAuthenticated,
    requireRole("admin"),
    asyncHandler(async (_req, res) => {
      // Placeholder for consent management
      sendSuccess(res, {
        message: "Funcionalidade de consentimentos em desenvolvimento",
        consents: [],
      });
    })
  );
}
