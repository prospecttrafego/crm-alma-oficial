import type { Express } from "express";
import { registerConversationListRoutes } from "./list";
import { registerMessageRoutes } from "./messages";
import { registerMessageSearchRoutes } from "./search";

export function registerConversationRoutes(app: Express) {
  registerMessageSearchRoutes(app);
  registerConversationListRoutes(app);
  registerMessageRoutes(app);
}
