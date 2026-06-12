import cors from "cors";
import express from "express";
import { createGamesRouter } from "./routes/games.js";
import { GameRepository } from "./repository/gameRepository.js";

function buildCorsOrigin() {
  const configured = (process.env.CORS_ORIGIN || "").trim();
  if (!configured) {
    return process.env.NODE_ENV === "production" ? false : true;
  }
  if (configured === "*") {
    return true;
  }

  const allowlist = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allowlist.includes(origin));
  };
}

export function createApp() {
  const app = express();
  const repository = new GameRepository();

  app.disable("x-powered-by");
  app.use(cors({ origin: buildCorsOrigin() }));
  app.use(express.json({ limit: "16kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "squarify-backend" });
  });

  app.use("/api/games", createGamesRouter(repository));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
