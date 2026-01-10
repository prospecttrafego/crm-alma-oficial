import "dotenv/config";
import express from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { requestIdMiddleware, requestLoggingMiddleware, logger } from "./logger";
import { globalErrorHandler, notFoundHandler } from "./middleware";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Middleware de requestId (antes de tudo para rastreabilidade)
app.use(requestIdMiddleware);

// Middleware de logging estruturado
app.use(requestLoggingMiddleware);

export function log(message: string, source = "express") {
  // Manter funcao legada para compatibilidade, mas usar logger estruturado
  logger.info(message, { service: source });
}

(async () => {
  // Initialize background job handlers
  const { initializeJobHandlers, startJobWorker } = await import("./jobs");
  initializeJobHandlers();
  startJobWorker();

  const httpServer = await registerRoutes(app);

  // 404 handler for unmatched API routes (must be after all API routes)
  app.use("/api", notFoundHandler);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Global error handler (must be last middleware)
  app.use(globalErrorHandler);

  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
