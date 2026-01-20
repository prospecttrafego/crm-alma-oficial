import type { Express } from "express";
import { registerLgpdExportRoutes } from "./export-contact";
import { registerLgpdDeleteRoutes } from "./delete-contact";
import { registerLgpdConsentRoutes } from "./consents";

export function registerLgpdRoutes(app: Express) {
  registerLgpdExportRoutes(app);
  registerLgpdDeleteRoutes(app);
  registerLgpdConsentRoutes(app);
}
