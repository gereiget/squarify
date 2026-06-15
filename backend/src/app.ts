import cors from "cors";
import express from "express";
import { createGamesRouter } from "./routes/games.js";
import { GameRepository, RepositoryTtlConfig } from "./repository/gameRepository.js";

function parseDurationMs(value: string | undefined, fallbackMs: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function parseConfigBody(body: unknown, fallback: RepositoryTtlConfig): RepositoryTtlConfig {
  const input = body as Record<string, unknown> | null | undefined;
  const waitingGameTtlMs = Number(input?.waitingGameTtlMs);
  const activeGameTtlMs = Number(input?.activeGameTtlMs);
  const finishedGameTtlMs = Number(input?.finishedGameTtlMs);

  if (![waitingGameTtlMs, activeGameTtlMs, finishedGameTtlMs].every((value) => Number.isFinite(value) && value > 0)) {
    return fallback;
  }

  return {
    waitingGameTtlMs,
    activeGameTtlMs,
    finishedGameTtlMs
  };
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
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

export function createApp() {
  const app = express();
  const repository = new GameRepository({
    waitingGameTtlMs: parseDurationMs(process.env.WAITING_GAME_TTL_MS, 30 * 60 * 1000),
    activeGameTtlMs: parseDurationMs(process.env.ACTIVE_GAME_TTL_MS, 12 * 60 * 60 * 1000),
    finishedGameTtlMs: parseDurationMs(process.env.FINISHED_GAME_TTL_MS, 60 * 60 * 1000)
  });
  let cleanupIntervalMs = parseDurationMs(process.env.GAME_CLEANUP_INTERVAL_MS, 5 * 60 * 1000);
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "change-me";
  let cleanupTimer = setInterval(() => {
    repository.pruneExpired();
  }, cleanupIntervalMs);
  cleanupTimer.unref();

  const resetCleanupTimer = (nextCleanupIntervalMs: number) => {
    clearInterval(cleanupTimer);
    cleanupIntervalMs = nextCleanupIntervalMs;
    cleanupTimer = setInterval(() => {
      repository.pruneExpired();
    }, cleanupIntervalMs);
    cleanupTimer.unref();
  };

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

  app.get("/api/admin/games", (_req, res) => {
    const games = repository.listGames();
    return res.json({
      games,
      ttlMs: repository.getTtlConfig(),
      cleanupIntervalMs
    });
  });

  app.post("/api/admin/config", (req, res) => {
    const current = repository.getTtlConfig();
    const nextTtlConfig = parseConfigBody(req.body, current);
    const nextCleanupIntervalMs = Number((req.body as Record<string, unknown> | null | undefined)?.cleanupIntervalMs);
    if (
      nextTtlConfig === current ||
      !Number.isFinite(nextCleanupIntervalMs) ||
      nextCleanupIntervalMs <= 0
    ) {
      return res.status(400).json({ error: "Invalid timeout configuration." });
    }

    repository.updateTtlConfig(nextTtlConfig);
    resetCleanupTimer(nextCleanupIntervalMs);
    return res.json({
      ttlMs: repository.getTtlConfig(),
      cleanupIntervalMs
    });
  });

  app.post("/admin/config", express.urlencoded({ extended: false }), (req, res) => {
    const current = repository.getTtlConfig();
    const nextTtlConfig = parseConfigBody(req.body, current);
    const nextCleanupIntervalMs = Number((req.body as Record<string, unknown> | null | undefined)?.cleanupIntervalMs);
    if (
      nextTtlConfig === current ||
      !Number.isFinite(nextCleanupIntervalMs) ||
      nextCleanupIntervalMs <= 0
    ) {
      return res.status(400).send("Invalid timeout configuration.");
    }

    repository.updateTtlConfig(nextTtlConfig);
    resetCleanupTimer(nextCleanupIntervalMs);
    return res.redirect("/admin/games");
  });

  app.get("/admin/games", (_req, res) => {
    const games = repository.listGames();
    const rows = games
      .map(
        (game) => `<tr>
<td>${escapeHtml(game.joinCode)}</td>
<td>${escapeHtml(game.gameId)}</td>
<td>${escapeHtml(game.status)}</td>
<td>${game.gridSize}x${game.gridSize}</td>
<td>${escapeHtml(game.players.map((player) => `${player.name} (${player.id}) score=${player.score}`).join(" | ") || "-")}</td>
<td>${escapeHtml(game.currentPlayerName ? `${game.currentPlayerName} (${game.currentPlayerId})` : "-")}</td>
<td>${escapeHtml(game.winnerName ? `${game.winnerName} (${game.winnerId})` : "-")}</td>
<td>${game.lineCount}</td>
<td>${game.boxCount}</td>
<td>${Math.round(game.idleMs / 1000)}s</td>
<td>${escapeHtml(game.createdAt)}</td>
<td>${escapeHtml(game.updatedAt)}</td>
<td>${escapeHtml(game.expiresAt)}</td>
</tr>`
      )
      .join("\n");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Squarify Admin</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; }
    body { margin: 0; background: #f8fafc; color: #0f172a; }
    main { max-width: 1400px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin-bottom: 8px; }
    .meta { display: grid; gap: 8px; margin: 0 0 24px; }
    .card { background: white; border-radius: 14px; padding: 16px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08); }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 14px; overflow: hidden; }
    th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #e2e8f0; }
    tr:last-child td { border-bottom: 0; }
    form { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: end; }
    label { display: grid; gap: 6px; font-size: 14px; }
    input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; }
    button { border: 0; border-radius: 10px; padding: 12px 16px; background: #0f766e; color: white; font-weight: 700; cursor: pointer; }
    .table-wrap { overflow-x: auto; }
  </style>
</head>
<body>
  <main>
    <h1>Squarify Running Games</h1>
    <div class="meta">
      <div class="card">Open sessions: ${games.length}</div>
      <div class="card">Waiting TTL: ${formatDuration(repository.getTtlConfig().waitingGameTtlMs)}, Active TTL: ${formatDuration(repository.getTtlConfig().activeGameTtlMs)}, Finished TTL: ${formatDuration(repository.getTtlConfig().finishedGameTtlMs)}</div>
      <div class="card">Cleanup interval: ${formatDuration(cleanupIntervalMs)}</div>
      <div class="card">
        <form method="post" action="/admin/config">
          <label>
            Waiting TTL ms
            <input type="number" min="1000" step="1000" name="waitingGameTtlMs" value="${repository.getTtlConfig().waitingGameTtlMs}" />
          </label>
          <label>
            Active TTL ms
            <input type="number" min="1000" step="1000" name="activeGameTtlMs" value="${repository.getTtlConfig().activeGameTtlMs}" />
          </label>
          <label>
            Finished TTL ms
            <input type="number" min="1000" step="1000" name="finishedGameTtlMs" value="${repository.getTtlConfig().finishedGameTtlMs}" />
          </label>
          <label>
            Cleanup interval ms
            <input type="number" min="1000" step="1000" name="cleanupIntervalMs" value="${cleanupIntervalMs}" />
          </label>
          <button type="submit">Save Timeouts</button>
        </form>
      </div>
    </div>
    <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Join Code</th>
          <th>Game ID</th>
          <th>Status</th>
          <th>Board</th>
          <th>Players</th>
          <th>Current Turn</th>
          <th>Winner</th>
          <th>Lines</th>
          <th>Boxes</th>
          <th>Idle</th>
          <th>Created</th>
          <th>Updated</th>
          <th>Expires</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="13">No active sessions.</td></tr>'}</tbody>
    </table>
    </div>
  </main>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
