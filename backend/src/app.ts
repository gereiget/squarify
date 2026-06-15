import path from "node:path";
import cors from "cors";
import express from "express";
import { createGamesRouter } from "./routes/games.js";
import { AdminRuntimeConfig, createDashboardHtml, GameRepository } from "./repository/gameRepository.js";

function parseDurationMs(value: string | undefined, fallbackMs: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

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

function parseRuntimeConfig(body: unknown, fallback: AdminRuntimeConfig): AdminRuntimeConfig | null {
  const input = body as Record<string, unknown> | null | undefined;
  const waitingGameTtlMs = Number(input?.waitingGameTtlMs);
  const activeGameTtlMs = Number(input?.activeGameTtlMs);
  const finishedGameTtlMs = Number(input?.finishedGameTtlMs);
  const cleanupIntervalMs = Number(input?.cleanupIntervalMs);

  if (![waitingGameTtlMs, activeGameTtlMs, finishedGameTtlMs, cleanupIntervalMs].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  return {
    waitingGameTtlMs,
    activeGameTtlMs,
    finishedGameTtlMs,
    cleanupIntervalMs
  };
}

function defaultStateFilePath() {
  return path.join(process.cwd(), "data", "state.json");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function createApp() {
  const app = express();
  const defaultConfig: AdminRuntimeConfig = {
    waitingGameTtlMs: parseDurationMs(process.env.WAITING_GAME_TTL_MS, 30 * 60 * 1000),
    activeGameTtlMs: parseDurationMs(process.env.ACTIVE_GAME_TTL_MS, 12 * 60 * 60 * 1000),
    finishedGameTtlMs: parseDurationMs(process.env.FINISHED_GAME_TTL_MS, 60 * 60 * 1000),
    cleanupIntervalMs: parseDurationMs(process.env.GAME_CLEANUP_INTERVAL_MS, 5 * 60 * 1000)
  };
  const repository = new GameRepository({
    runtimeConfig: defaultConfig,
    stateFilePath: process.env.STATE_FILE_PATH || defaultStateFilePath(),
    maxHistoryRecords: parseDurationMs(process.env.MAX_HISTORY_RECORDS, 2000)
  });
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "change-me";
  let cleanupTimer = setInterval(() => {
    repository.pruneExpired();
  }, repository.getRuntimeConfig().cleanupIntervalMs);
  cleanupTimer.unref();

  const resetCleanupTimer = (cleanupIntervalMs: number) => {
    clearInterval(cleanupTimer);
    cleanupTimer = setInterval(() => {
      repository.pruneExpired();
    }, cleanupIntervalMs);
    cleanupTimer.unref();
  };

  app.disable("x-powered-by");
  app.use(cors({ origin: buildCorsOrigin() }));
  app.use(express.json({ limit: "32kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "squarify-backend" });
  });

  const requireAdmin: express.RequestHandler = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Squarify Admin"');
      return res.status(401).send("Authentication required.");
    }

    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    const username = separator >= 0 ? decoded.slice(0, separator) : decoded;
    const password = separator >= 0 ? decoded.slice(separator + 1) : "";
    if (username !== adminUsername || password !== adminPassword) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Squarify Admin"');
      return res.status(401).send("Invalid credentials.");
    }

    return next();
  };

  app.use("/admin", requireAdmin);
  app.use("/api/admin", requireAdmin);
  app.use("/api/games", createGamesRouter(repository));

  app.get("/api/admin/dashboard", (_req, res) => {
    return res.json({
      generatedAt: new Date().toISOString(),
      ...repository.getDashboardData()
    });
  });

  app.get("/api/admin/games", (_req, res) => {
    return res.json(repository.getDashboardData());
  });

  app.post("/api/admin/config", (req, res) => {
    const nextConfig = parseRuntimeConfig(req.body, repository.getRuntimeConfig());
    if (!nextConfig) {
      return res.status(400).json({ error: "Invalid timeout configuration." });
    }

    repository.updateRuntimeConfig(nextConfig);
    resetCleanupTimer(nextConfig.cleanupIntervalMs);
    return res.json({
      message: "Settings updated.",
      config: repository.getRuntimeConfig()
    });
  });

  app.get("/admin", (_req, res) => {
    res.redirect("/admin/games");
  });

  app.get("/admin/games", (_req, res) => {
    const html = createDashboardHtml({
      apiPath: "/api/admin/dashboard",
      configPath: "/api/admin/config",
      username: escapeHtml(adminUsername)
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
