import fs from "node:fs";
import path from "node:path";
import { Game } from "../domain/types.js";

export interface RepositoryTtlConfig {
  waitingGameTtlMs: number;
  activeGameTtlMs: number;
  finishedGameTtlMs: number;
}

export interface AdminRuntimeConfig extends RepositoryTtlConfig {
  cleanupIntervalMs: number;
}

export interface GameSummaryPlayer {
  id: string;
  name: string;
  score: number;
  lastSeenIp: string | null;
  isCurrentTurn: boolean;
  isWinner: boolean;
}

export interface GameSummary {
  gameId: string;
  joinCode: string;
  matchNumber: number;
  matchStartedAt: string;
  gridSize: number;
  status: Game["status"];
  players: GameSummaryPlayer[];
  currentPlayerId: string;
  currentPlayerName: string | null;
  winnerId: string | null;
  winnerName: string | null;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
  boxCount: number;
  idleMs: number;
  expiresAt: string;
}

export type HistoryReason =
  | "finished"
  | "restarted"
  | "deleted"
  | "expired_waiting"
  | "expired_active"
  | "expired_finished";

export interface HistoricalGameRecord {
  archiveKey: string;
  archiveReason: HistoryReason;
  archivedAt: string;
  gameId: string;
  joinCode: string;
  matchNumber: number;
  matchStartedAt: string;
  gridSize: number;
  status: Game["status"];
  players: GameSummaryPlayer[];
  winnerId: string | null;
  winnerName: string | null;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  lineCount: number;
  boxCount: number;
}

export interface PlayerHistorySummary {
  name: string;
  gamesPlayed: number;
  wins: number;
  draws: number;
  totalScore: number;
  averageScore: number;
  lastSeenAt: string;
}

export interface AdminDashboardData {
  config: AdminRuntimeConfig;
  currentGames: GameSummary[];
  history: HistoricalGameRecord[];
  playerHistory: PlayerHistorySummary[];
}

interface PersistedRepositoryState {
  config: AdminRuntimeConfig;
  games: Game[];
  history: HistoricalGameRecord[];
}

interface RepositoryOptions {
  runtimeConfig: AdminRuntimeConfig;
  stateFilePath: string;
  maxHistoryRecords: number;
}

interface DashboardHtmlOptions {
  apiPath: string;
  configPath: string;
  username: string;
}

function cloneGame(game: Game): Game {
  return JSON.parse(JSON.stringify(game)) as Game;
}

function keyForRecord(gameId: string, matchNumber: number): string {
  return `${gameId}:${matchNumber}`;
}

export function createDashboardHtml(options: DashboardHtmlOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Squarify Admin Dashboard</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3ede2;
      --panel: rgba(255,255,255,0.78);
      --panel-strong: rgba(255,255,255,0.96);
      --ink: #172033;
      --muted: #5f6b7a;
      --line: rgba(23,32,51,0.10);
      --accent: #0f766e;
      --accent-2: #b98429;
      --accent-soft: rgba(15,118,110,0.10);
      --danger: #a63d40;
      --shadow: 0 24px 70px rgba(23,32,51,0.13);
      font-family: Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(15,118,110,0.18), transparent 30%),
        radial-gradient(circle at top right, rgba(192,132,41,0.16), transparent 28%),
        linear-gradient(180deg, #fbf8f2 0%, var(--bg) 100%);
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(115deg, rgba(255,255,255,0.12), transparent 26%, transparent 74%, rgba(255,255,255,0.14)),
        repeating-linear-gradient(90deg, rgba(23,32,51,0.02), rgba(23,32,51,0.02) 1px, transparent 1px, transparent 24px);
      opacity: 0.4;
    }
    main {
      position: relative;
      max-width: 1440px;
      margin: 0 auto;
      padding: 32px 20px 60px;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: end;
      margin-bottom: 18px;
    }
    .hero h1 {
      margin: 0 0 10px;
      font-size: clamp(38px, 5vw, 72px);
      line-height: 0.92;
      letter-spacing: -0.05em;
      font-family: Georgia, "Times New Roman", serif;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      max-width: 760px;
      font-size: 20px;
      line-height: 1.45;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(255,255,255,0.72);
      border: 1px solid var(--line);
      border-radius: 999px;
      box-shadow: var(--shadow);
      font-size: 14px;
      margin-bottom: 18px;
    }
    .grid {
      display: grid;
      gap: 16px;
    }
    .overview {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin-bottom: 20px;
    }
    .panel {
      min-width: 0;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 26px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(14px);
    }
    .stat {
      padding: 20px;
    }
    .stat h2, .section-title h2 {
      margin: 0;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .stat strong {
      display: block;
      margin-top: 10px;
      font-size: 34px;
      letter-spacing: -0.04em;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }
    .stack {
      display: grid;
      gap: 16px;
      min-width: 0;
    }
    .section {
      padding: 22px;
      min-width: 0;
    }
    .section-title {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 18px;
      min-width: 0;
    }
    .section-title p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.45;
    }
    .settings-form {
      display: grid;
      gap: 14px;
      min-width: 0;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    input {
      width: 100%;
      padding: 12px 13px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.96);
      color: var(--ink);
      font: inherit;
      min-width: 0;
      outline: none;
    }
    input:focus {
      border-color: rgba(15,118,110,0.38);
      box-shadow: 0 0 0 4px rgba(15,118,110,0.08);
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    button {
      appearance: none;
      border: 0;
      border-radius: 16px;
      padding: 12px 16px;
      background: linear-gradient(135deg, var(--accent), #0d635c);
      color: white;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 16px 24px rgba(15,118,110,0.18);
    }
    button.secondary {
      background: rgba(255,255,255,0.72);
      color: var(--ink);
      box-shadow: none;
      border: 1px solid var(--line);
    }
    .message {
      min-height: 20px;
      font-size: 14px;
      color: var(--muted);
      line-height: 1.45;
    }
    .message.error {
      color: var(--danger);
    }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
    }
    .live-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.78);
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }
    .live-tag::before {
      content: "";
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      box-shadow: 0 0 0 6px rgba(15,118,110,0.10);
    }
    .cards {
      display: grid;
      gap: 14px;
      min-width: 0;
    }
    .game-card {
      padding: 18px;
      border-radius: 20px;
      background: var(--panel-strong);
      border: 1px solid rgba(23,32,51,0.08);
    }
    .game-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .game-name {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .chip {
      padding: 6px 10px;
      border-radius: 999px;
      background: #f2f4f6;
      font-size: 12px;
      white-space: nowrap;
    }
    .players {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .player {
      padding: 12px;
      border-radius: 16px;
      background: #f7f8fa;
      border: 1px solid rgba(23,32,51,0.06);
    }
    .player strong {
      display: block;
      font-size: 16px;
      margin-bottom: 6px;
    }
    .muted { color: var(--muted); }
    .subtle {
      font-size: 13px;
      color: var(--muted);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 11px 10px;
      border-bottom: 1px solid #e6e2d8;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .table-wrap {
      overflow: auto;
      border-radius: 18px;
      background: rgba(255,255,255,0.62);
      min-width: 0;
    }
    .bar {
      height: 10px;
      border-radius: 999px;
      background: #e8e0cf;
      overflow: hidden;
      min-width: 120px;
    }
    .bar > span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent-2));
    }
    .empty-state {
      padding: 28px 18px;
      border-radius: 18px;
      border: 1px dashed rgba(23,32,51,0.16);
      text-align: center;
      color: var(--muted);
      background: rgba(255,255,255,0.54);
    }
    .loading-grid {
      display: grid;
      gap: 12px;
    }
    .loading-line {
      height: 16px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(15,118,110,0.08), rgba(185,132,41,0.12), rgba(15,118,110,0.08));
      background-size: 200% 100%;
      animation: shimmer 1.25s linear infinite;
    }
    @keyframes shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }
    @media (max-width: 1080px) {
      .layout { grid-template-columns: 1fr; }
      .hero { grid-template-columns: 1fr; align-items: start; }
      .toolbar { justify-content: flex-start; }
    }
    @media (max-width: 720px) {
      main { padding: 22px 14px 40px; }
      .section, .stat { padding: 18px; }
      .players { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <div class="badge">Admin user: ${options.username}</div>
        <h1>Squarify Admin Dashboard</h1>
        <p>Manage live timeout settings, inspect current multiplayer sessions, and review historical game and player data persisted by the backend.</p>
      </div>
      <div class="toolbar">
        <span class="live-tag" id="lastUpdated">Waiting for data</span>
        <button id="refreshBtn" class="secondary" type="button">Refresh Now</button>
        <form method="post" action="./logout">
          <button class="secondary" type="submit">Log Out</button>
        </form>
      </div>
    </section>

    <section class="grid overview" id="overview"></section>

    <section class="layout">
      <aside class="stack">
        <div class="panel section">
          <div class="section-title">
            <div>
              <h2>Runtime Settings</h2>
              <p>These values update the running backend immediately.</p>
            </div>
          </div>
          <form id="settingsForm" class="settings-form">
            <label>Waiting timeout (ms)<input name="waitingGameTtlMs" type="number" min="1000" step="1000" required /></label>
            <label>Active timeout (ms)<input name="activeGameTtlMs" type="number" min="1000" step="1000" required /></label>
            <label>Finished timeout (ms)<input name="finishedGameTtlMs" type="number" min="1000" step="1000" required /></label>
            <label>Cleanup interval (ms)<input name="cleanupIntervalMs" type="number" min="1000" step="1000" required /></label>
            <div class="actions">
              <button type="submit">Save Settings</button>
            </div>
            <div id="settingsMessage" class="message"></div>
          </form>
        </div>

        <div class="panel section">
          <div class="section-title">
            <div>
              <h2>Player History</h2>
              <p>Aggregated from archived matches.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Games</th>
                  <th>Wins</th>
                  <th>Draws</th>
                  <th>Total Score</th>
                  <th>Average</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody id="playerHistoryBody"></tbody>
            </table>
          </div>
        </div>
      </aside>

      <section class="stack">
        <div class="panel section">
          <div class="section-title">
            <div>
              <h2>Current Games</h2>
              <p>Live sessions, active lobbies, and finished games still within retention.</p>
            </div>
          </div>
          <div id="currentGames" class="cards">
            <div class="loading-grid">
              <div class="loading-line" style="width: 40%"></div>
              <div class="loading-line" style="width: 100%"></div>
              <div class="loading-line" style="width: 82%"></div>
            </div>
          </div>
        </div>

        <div class="panel section">
          <div class="section-title">
            <div>
              <h2>Historical Games</h2>
              <p>Archived sessions, including finished, restarted, deleted, and expired rooms.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Archived</th>
                  <th>Reason</th>
                  <th>Game</th>
                  <th>Board</th>
                  <th>Players</th>
                  <th>Winner</th>
                  <th>Duration</th>
                  <th>Lines</th>
                  <th>Boxes</th>
                </tr>
              </thead>
              <tbody id="historyBody"></tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  </main>

  <script>
    const apiPath = ${JSON.stringify(options.apiPath)};
    const configPath = ${JSON.stringify(options.configPath)};

    function resolvePath(path) {
      return new URL(path, window.location.href).toString();
    }

    function formatDate(value) {
      if (!value) return "-";
      return new Date(value).toLocaleString();
    }

    function formatDuration(ms) {
      const totalSeconds = Math.max(0, Math.round(ms / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours > 0) return hours + "h " + minutes + "m";
      if (minutes > 0) return minutes + "m " + seconds + "s";
      return seconds + "s";
    }

    function setMessage(text, isError) {
      const node = document.getElementById("settingsMessage");
      node.textContent = text || "";
      node.className = isError ? "message error" : "message";
    }

    function setLastUpdated(value) {
      const node = document.getElementById("lastUpdated");
      node.textContent = value ? "Last refresh " + formatDate(value) : "Waiting for data";
    }

    function renderOverview(data) {
      const topPlayer = data.playerHistory[0];
      const overview = [
        { title: "Live Games", value: String(data.currentGames.length), detail: "Current sessions retained in storage" },
        { title: "Archived Matches", value: String(data.history.length), detail: "Historical records available to admin" },
        { title: "Top Player", value: topPlayer ? topPlayer.name : "-", detail: topPlayer ? topPlayer.wins + " wins" : "No archived games yet" },
        { title: "Active Timeout", value: formatDuration(data.config.activeGameTtlMs), detail: "Runtime retention window for live games" }
      ];

      document.getElementById("overview").innerHTML = overview.map((item) => \`
        <div class="panel stat">
          <h2>\${item.title}</h2>
          <strong>\${item.value}</strong>
          <div class="muted">\${item.detail}</div>
        </div>
      \`).join("");
    }

    function renderSettings(config) {
      const form = document.getElementById("settingsForm");
      form.waitingGameTtlMs.value = config.waitingGameTtlMs;
      form.activeGameTtlMs.value = config.activeGameTtlMs;
      form.finishedGameTtlMs.value = config.finishedGameTtlMs;
      form.cleanupIntervalMs.value = config.cleanupIntervalMs;
    }

    function renderCurrentGames(games) {
      const container = document.getElementById("currentGames");
      if (!games.length) {
        container.innerHTML = '<div class="empty-state">No open games right now.</div>';
        return;
      }
      container.innerHTML = games.map((game) => \`
        <article class="game-card">
          <div class="game-top">
            <div>
              <div class="game-name">\${game.joinCode}</div>
              <div class="subtle">Game \${game.gameId} | Match #\${game.matchNumber}</div>
            </div>
            <div class="chips">
              <span class="chip">\${game.status}</span>
              <span class="chip">\${game.gridSize}x\${game.gridSize}</span>
              <span class="chip">Idle \${formatDuration(game.idleMs)}</span>
              <span class="chip">Expires \${formatDate(game.expiresAt)}</span>
            </div>
          </div>
          <div class="chips">
            <span class="chip">Created \${formatDate(game.createdAt)}</span>
            <span class="chip">Started \${formatDate(game.matchStartedAt)}</span>
            <span class="chip">Updated \${formatDate(game.updatedAt)}</span>
            <span class="chip">Lines \${game.lineCount}</span>
            <span class="chip">Boxes \${game.boxCount}</span>
            <span class="chip">Turn \${game.currentPlayerName || "-"}</span>
            <span class="chip">Winner \${game.winnerName || "-"}</span>
          </div>
          <div class="players">
            \${game.players.map((player) => \`
              <div class="player">
                <strong>\${player.name}</strong>
                <div class="muted">ID: \${player.id}</div>
                <div class="muted">IP: \${player.lastSeenIp || "-"}</div>
                <div>Score: \${player.score}</div>
                <div>\${player.isCurrentTurn ? "Current turn" : ""} \${player.isWinner ? "Winner" : ""}</div>
              </div>
            \`).join("")}
          </div>
        </article>
      \`).join("");
    }

    function renderHistory(records) {
      const tbody = document.getElementById("historyBody");
      if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="9">No historical games yet.</td></tr>';
        return;
      }
      tbody.innerHTML = records.map((record) => \`
        <tr>
          <td>\${formatDate(record.archivedAt)}</td>
          <td>\${record.archiveReason}</td>
          <td>\${record.joinCode}<div class="muted">\${record.gameId} / #\${record.matchNumber}</div></td>
          <td>\${record.gridSize}x\${record.gridSize}</td>
          <td>\${record.players.map((player) => player.name + " (" + player.score + ")").join(" vs ")}</td>
          <td>\${record.winnerName || "Draw / none"}</td>
          <td>\${formatDuration(record.durationMs)}</td>
          <td>\${record.lineCount}</td>
          <td>\${record.boxCount}</td>
        </tr>
      \`).join("");
    }

    function renderPlayerHistory(players) {
      const tbody = document.getElementById("playerHistoryBody");
      if (!players.length) {
        tbody.innerHTML = '<tr><td colspan="7">No player history yet.</td></tr>';
        return;
      }
      const maxWins = Math.max(...players.map((player) => player.wins), 1);
      tbody.innerHTML = players.map((player) => \`
        <tr>
          <td>
            <strong>\${player.name}</strong>
            <div class="bar"><span style="width:\${Math.max(8, Math.round(player.wins / maxWins * 100))}%"></span></div>
          </td>
          <td>\${player.gamesPlayed}</td>
          <td>\${player.wins}</td>
          <td>\${player.draws}</td>
          <td>\${player.totalScore}</td>
          <td>\${player.averageScore}</td>
          <td>\${formatDate(player.lastSeenAt)}</td>
        </tr>
      \`).join("");
    }

    async function loadDashboard() {
      const response = await fetch(resolvePath(apiPath), {
        headers: { "Accept": "application/json" },
        credentials: "same-origin"
      });
      if (!response.ok) {
        throw new Error("Failed to load dashboard.");
      }
      const data = await response.json();
      setLastUpdated(data.generatedAt || new Date().toISOString());
      renderOverview(data);
      renderSettings(data.config);
      renderCurrentGames(data.currentGames);
      renderHistory(data.history);
      renderPlayerHistory(data.playerHistory);
    }

    document.getElementById("settingsForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      setMessage("Saving settings...", false);
      try {
        const payload = {
          waitingGameTtlMs: Number(form.waitingGameTtlMs.value),
          activeGameTtlMs: Number(form.activeGameTtlMs.value),
          finishedGameTtlMs: Number(form.finishedGameTtlMs.value),
          cleanupIntervalMs: Number(form.cleanupIntervalMs.value)
        };
        const response = await fetch(resolvePath(configPath), {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error || "Failed to save settings.");
        }
        setMessage("Settings updated. Update the VPS .env too if you want them to survive a container rebuild.", false);
        await loadDashboard();
      } catch (error) {
        setMessage(error.message || "Failed to save settings.", true);
      }
    });

    document.getElementById("refreshBtn").addEventListener("click", () => {
      loadDashboard().catch((error) => setMessage(error.message || "Failed to refresh dashboard.", true));
    });

    loadDashboard().catch((error) => setMessage(error.message || "Failed to load dashboard.", true));
    window.setInterval(() => {
      loadDashboard().catch(() => {});
    }, 15000);
  </script>
</body>
</html>`;
}

export class GameRepository {
  private readonly games = new Map<string, Game>();
  private readonly stateFilePath: string;
  private readonly maxHistoryRecords: number;
  private config: AdminRuntimeConfig;
  private history: HistoricalGameRecord[] = [];

  constructor(options: RepositoryOptions) {
    this.stateFilePath = options.stateFilePath;
    this.maxHistoryRecords = options.maxHistoryRecords;
    this.config = options.runtimeConfig;
    this.loadState();
    this.pruneExpired();
  }

  save(game: Game): Game {
    this.pruneExpired();
    const snapshot = cloneGame(game);
    this.games.set(snapshot.gameId, snapshot);
    if (snapshot.status === "finished") {
      this.upsertHistory(snapshot, "finished");
    }
    this.persistState();
    return snapshot;
  }

  findById(gameId: string): Game | undefined {
    this.pruneExpired();
    const game = this.games.get(gameId);
    return game ? cloneGame(game) : undefined;
  }

  findByJoinCode(joinCode: string): Game | undefined {
    this.pruneExpired();
    const game = Array.from(this.games.values()).find((entry) => entry.joinCode === joinCode.toUpperCase());
    return game ? cloneGame(game) : undefined;
  }

  delete(gameId: string): boolean {
    this.pruneExpired();
    const existing = this.games.get(gameId);
    if (!existing) {
      return false;
    }
    this.upsertHistory(existing, "deleted");
    this.games.delete(gameId);
    this.persistState();
    return true;
  }

  archiveForRestart(gameId: string): void {
    const existing = this.games.get(gameId);
    if (!existing) {
      return;
    }
    this.upsertHistory(existing, "restarted");
    this.persistState();
  }

  listGames(): GameSummary[] {
    this.pruneExpired();
    const now = Date.now();
    return Array.from(this.games.values())
      .map((game) => this.toSummary(game, now))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  listHistory(): HistoricalGameRecord[] {
    return [...this.history].sort((left, right) => right.archivedAt.localeCompare(left.archivedAt));
  }

  listPlayerHistory(): PlayerHistorySummary[] {
    const stats = new Map<string, PlayerHistorySummary>();
    for (const game of this.history) {
      for (const player of game.players) {
        const current = stats.get(player.name) ?? {
          name: player.name,
          gamesPlayed: 0,
          wins: 0,
          draws: 0,
          totalScore: 0,
          averageScore: 0,
          lastSeenAt: game.archivedAt
        };
        current.gamesPlayed += 1;
        current.totalScore += player.score;
        current.wins += player.isWinner ? 1 : 0;
        current.draws += game.winnerId ? 0 : 1;
        if (game.archivedAt > current.lastSeenAt) {
          current.lastSeenAt = game.archivedAt;
        }
        stats.set(player.name, current);
      }
    }

    return Array.from(stats.values())
      .map((player) => ({
        ...player,
        averageScore: player.gamesPlayed > 0 ? Number((player.totalScore / player.gamesPlayed).toFixed(2)) : 0
      }))
      .sort((left, right) => {
        if (right.wins !== left.wins) {
          return right.wins - left.wins;
        }
        if (right.gamesPlayed !== left.gamesPlayed) {
          return right.gamesPlayed - left.gamesPlayed;
        }
        return right.totalScore - left.totalScore;
      });
  }

  getRuntimeConfig(): AdminRuntimeConfig {
    return { ...this.config };
  }

  updateRuntimeConfig(nextConfig: AdminRuntimeConfig): AdminRuntimeConfig {
    this.config = { ...nextConfig };
    this.pruneExpired();
    this.persistState();
    return this.getRuntimeConfig();
  }

  getDashboardData(): AdminDashboardData {
    return {
      config: this.getRuntimeConfig(),
      currentGames: this.listGames(),
      history: this.listHistory(),
      playerHistory: this.listPlayerHistory()
    };
  }

  pruneExpired(now = Date.now()): number {
    let deleted = 0;
    for (const game of this.games.values()) {
      const expiresAt = this.getExpiresAtMs(game);
      if (expiresAt <= now) {
        const reason: HistoryReason =
          game.status === "waiting"
            ? "expired_waiting"
            : game.status === "active"
              ? "expired_active"
              : "expired_finished";
        this.upsertHistory(game, reason);
        this.games.delete(game.gameId);
        deleted += 1;
      }
    }
    if (deleted > 0) {
      this.persistState();
    }
    return deleted;
  }

  private loadState(): void {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        return;
      }
      const raw = fs.readFileSync(this.stateFilePath, "utf8");
      if (!raw.trim()) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedRepositoryState>;
      const persistedConfig = parsed.config;
      if (persistedConfig) {
        this.config = {
          waitingGameTtlMs: Number(persistedConfig.waitingGameTtlMs) || this.config.waitingGameTtlMs,
          activeGameTtlMs: Number(persistedConfig.activeGameTtlMs) || this.config.activeGameTtlMs,
          finishedGameTtlMs: Number(persistedConfig.finishedGameTtlMs) || this.config.finishedGameTtlMs,
          cleanupIntervalMs: Number(persistedConfig.cleanupIntervalMs) || this.config.cleanupIntervalMs
        };
      }
      for (const game of parsed.games ?? []) {
        this.games.set(game.gameId, game);
      }
      this.history = Array.isArray(parsed.history) ? parsed.history.slice(0, this.maxHistoryRecords) : [];
    } catch (error) {
      console.error("Failed to load repository state:", error);
    }
  }

  private persistState(): void {
    try {
      const directory = path.dirname(this.stateFilePath);
      fs.mkdirSync(directory, { recursive: true });
      const tempPath = `${this.stateFilePath}.tmp`;
      const payload: PersistedRepositoryState = {
        config: this.config,
        games: Array.from(this.games.values()),
        history: this.history.slice(0, this.maxHistoryRecords)
      };
      fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
      fs.renameSync(tempPath, this.stateFilePath);
    } catch (error) {
      console.error("Failed to persist repository state:", error);
    }
  }

  private upsertHistory(game: Game, reason: HistoryReason): void {
    const archiveKey = keyForRecord(game.gameId, game.matchNumber);
    const archivedAt = new Date().toISOString();
    const record: HistoricalGameRecord = {
      archiveKey,
      archiveReason: reason,
      archivedAt,
      gameId: game.gameId,
      joinCode: game.joinCode,
      matchNumber: game.matchNumber,
      matchStartedAt: game.matchStartedAt,
      gridSize: game.gridSize,
      status: game.status,
      players: this.toSummary(game, Date.now()).players,
      winnerId: game.winner,
      winnerName: game.winner ? game.players.find((player) => player.id === game.winner)?.name ?? null : null,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      durationMs: Math.max(0, Date.parse(game.updatedAt) - Date.parse(game.matchStartedAt)),
      lineCount: game.lines.length,
      boxCount: game.boxes.length
    };

    const existingIndex = this.history.findIndex((entry) => entry.archiveKey === archiveKey);
    if (existingIndex >= 0) {
      this.history[existingIndex] = record;
    } else {
      this.history.unshift(record);
    }
    this.history = this.history
      .sort((left, right) => right.archivedAt.localeCompare(left.archivedAt))
      .slice(0, this.maxHistoryRecords);
  }

  private toSummary(game: Game, now: number): GameSummary {
    const currentPlayer = game.players.find((player) => player.id === game.currentPlayerId) ?? null;
    const winner = game.winner ? game.players.find((player) => player.id === game.winner) ?? null : null;
    return {
      gameId: game.gameId,
      joinCode: game.joinCode,
      matchNumber: game.matchNumber,
      matchStartedAt: game.matchStartedAt,
      gridSize: game.gridSize,
      status: game.status,
      players: game.players.map((player) => ({
        id: player.id,
        name: player.name,
        score: game.scores[player.id] ?? 0,
        lastSeenIp: player.lastSeenIp,
        isCurrentTurn: player.id === game.currentPlayerId,
        isWinner: player.id === game.winner
      })),
      currentPlayerId: game.currentPlayerId,
      currentPlayerName: currentPlayer?.name ?? null,
      winnerId: winner?.id ?? null,
      winnerName: winner?.name ?? null,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      lineCount: game.lines.length,
      boxCount: game.boxes.length,
      idleMs: Math.max(0, now - Date.parse(game.updatedAt)),
      expiresAt: new Date(this.getExpiresAtMs(game)).toISOString()
    };
  }

  private getExpiresAtMs(game: Game): number {
    const ttlMs =
      game.status === "waiting"
        ? this.config.waitingGameTtlMs
        : game.status === "active"
          ? this.config.activeGameTtlMs
          : this.config.finishedGameTtlMs;
    return Date.parse(game.updatedAt) + ttlMs;
  }
}
