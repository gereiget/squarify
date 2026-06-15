import path from "node:path";
import crypto from "node:crypto";
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

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return accumulator;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function buildSessionCookie(token: string): string {
  return [
    `squarify_admin_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=86400",
    "Secure"
  ].join("; ");
}

function clearSessionCookie(): string {
  return [
    "squarify_admin_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Secure"
  ].join("; ");
}

function createLoginHtml(errorMessage?: string): string {
  const errorBlock = errorMessage
    ? `<div class="notice error">${escapeHtml(errorMessage)}</div>`
    : `<div class="notice">Use your admin credentials to manage live games, retention settings, and history.</div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Squarify Admin Login</title>
  <style>
    :root {
      --ink: #162033;
      --muted: #64748b;
      --panel: rgba(255,255,255,0.88);
      --line: rgba(22,32,51,0.10);
      --accent: #0f766e;
      --accent-dark: #0b5d57;
      --danger: #b42318;
      font-family: Georgia, "Times New Roman", serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(15,118,110,0.18), transparent 28%),
        radial-gradient(circle at bottom right, rgba(214,163,74,0.22), transparent 30%),
        linear-gradient(145deg, #f7f4ed 0%, #efe8dc 100%);
      color: var(--ink);
    }
    .shell {
      width: min(980px, 100%);
      display: grid;
      grid-template-columns: minmax(280px, 1.1fr) minmax(320px, 0.9fr);
      border-radius: 28px;
      overflow: hidden;
      background: rgba(255,255,255,0.72);
      border: 1px solid rgba(255,255,255,0.6);
      box-shadow: 0 30px 80px rgba(22,32,51,0.16);
      backdrop-filter: blur(18px);
    }
    .hero, .form-wrap {
      padding: 40px 36px;
    }
    .hero {
      background:
        linear-gradient(180deg, rgba(15,118,110,0.08), rgba(15,118,110,0)),
        linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,247,232,0.88));
      display: grid;
      align-content: center;
      gap: 18px;
    }
    .eyebrow {
      display: inline-flex;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(15,118,110,0.10);
      color: #0b5d57;
      font: 600 12px/1.2 Arial, sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(40px, 5vw, 64px);
      line-height: 0.94;
      letter-spacing: -0.04em;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      font: 400 20px/1.5 Arial, sans-serif;
      max-width: 34rem;
    }
    .hero ul {
      margin: 6px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 10px;
      color: var(--ink);
      font: 500 15px/1.45 Arial, sans-serif;
    }
    .hero li::before {
      content: "";
      display: inline-block;
      width: 9px;
      height: 9px;
      margin-right: 10px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0f766e, #d6a34a);
      vertical-align: middle;
    }
    .form-wrap {
      display: grid;
      align-content: center;
      gap: 18px;
      background: rgba(255,255,255,0.92);
    }
    .title {
      display: grid;
      gap: 8px;
    }
    .title h2 {
      margin: 0;
      font: 700 28px/1.1 Arial, sans-serif;
      letter-spacing: -0.03em;
    }
    .title p {
      margin: 0;
      color: var(--muted);
      font: 400 14px/1.5 Arial, sans-serif;
    }
    form {
      display: grid;
      gap: 14px;
    }
    label {
      display: grid;
      gap: 8px;
      font: 600 13px/1.3 Arial, sans-serif;
      color: var(--muted);
    }
    input {
      width: 100%;
      padding: 14px 15px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      font: 500 16px/1.2 Arial, sans-serif;
      outline: none;
    }
    input:focus {
      border-color: rgba(15,118,110,0.4);
      box-shadow: 0 0 0 4px rgba(15,118,110,0.10);
    }
    button {
      border: 0;
      border-radius: 16px;
      padding: 14px 18px;
      background: linear-gradient(135deg, var(--accent), var(--accent-dark));
      color: white;
      font: 700 16px/1 Arial, sans-serif;
      cursor: pointer;
      box-shadow: 0 18px 28px rgba(15,118,110,0.20);
    }
    .notice {
      border-radius: 16px;
      padding: 13px 14px;
      background: rgba(15,118,110,0.08);
      color: #0b5d57;
      font: 500 14px/1.45 Arial, sans-serif;
    }
    .notice.error {
      background: rgba(180,35,24,0.09);
      color: var(--danger);
    }
    @media (max-width: 860px) {
      .shell { grid-template-columns: 1fr; }
      .hero, .form-wrap { padding: 28px 24px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <span class="eyebrow">Squarify Control Room</span>
      <h1>Admin Access</h1>
      <p>Sign in to manage live multiplayer games, retention windows, and long-term player history.</p>
      <ul>
        <li>Inspect live games and current players in real time</li>
        <li>Adjust waiting, active, and finished session timeouts</li>
        <li>Review archived matches and player performance history</li>
      </ul>
    </section>
    <section class="form-wrap">
      <div class="title">
        <h2>Sign In</h2>
        <p>Use the backend admin credentials configured on the server.</p>
      </div>
      ${errorBlock}
      <form method="post" action="./login">
        <label>
          Username
          <input type="text" name="username" autocomplete="username" required />
        </label>
        <label>
          Password
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <button type="submit">Open Dashboard</button>
      </form>
    </section>
  </main>
</body>
</html>`;
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
  const adminSessions = new Set<string>();
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
  app.use(express.urlencoded({ extended: false }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "squarify-backend" });
  });

  const requireAdminPage: express.RequestHandler = (req, res, next) => {
    const sessionToken = parseCookies(req.headers.cookie).squarify_admin_session;
    if (!sessionToken || !adminSessions.has(sessionToken)) {
      return res.redirect("/admin/login");
    }
    return next();
  };

  const requireAdminApi: express.RequestHandler = (req, res, next) => {
    const sessionToken = parseCookies(req.headers.cookie).squarify_admin_session;
    if (!sessionToken || !adminSessions.has(sessionToken)) {
      return res.status(401).json({ error: "Authentication required." });
    }
    return next();
  };

  app.use("/api/games", createGamesRouter(repository));
  app.use("/api/admin", requireAdminApi);

  app.get("/admin/login", (req, res) => {
    const sessionToken = parseCookies(req.headers.cookie).squarify_admin_session;
    if (sessionToken && adminSessions.has(sessionToken)) {
      return res.redirect("./games");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(createLoginHtml());
  });

  app.post("/admin/login", (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (username !== adminUsername || password !== adminPassword) {
      res.status(401);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(createLoginHtml("Invalid username or password."));
    }

    const token = crypto.randomBytes(24).toString("hex");
    adminSessions.add(token);
    res.setHeader("Set-Cookie", buildSessionCookie(token));
    return res.redirect("./games");
  });

  app.post("/admin/logout", requireAdminPage, (req, res) => {
    const sessionToken = parseCookies(req.headers.cookie).squarify_admin_session;
    if (sessionToken) {
      adminSessions.delete(sessionToken);
    }
    res.setHeader("Set-Cookie", clearSessionCookie());
    return res.redirect("./login");
  });

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
    res.redirect("./admin/games");
  });

  app.get("/admin/games", requireAdminPage, (_req, res) => {
    const html = createDashboardHtml({
      apiPath: "../api/admin/dashboard",
      configPath: "../api/admin/config",
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
