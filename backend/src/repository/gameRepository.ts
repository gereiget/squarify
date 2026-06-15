import { Game } from "../domain/types.js";

export interface RepositoryTtlConfig {
  waitingGameTtlMs: number;
  activeGameTtlMs: number;
  finishedGameTtlMs: number;
}

export interface GameSummaryPlayer {
  id: string;
  name: string;
  score: number;
  isCurrentTurn: boolean;
  isWinner: boolean;
}

export interface GameSummary {
  gameId: string;
  joinCode: string;
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

export class GameRepository {
  private readonly games = new Map<string, Game>();
  private ttlConfig: RepositoryTtlConfig;

  constructor(ttlConfig: RepositoryTtlConfig) {
    this.ttlConfig = ttlConfig;
  }

  save(game: Game): Game {
    this.pruneExpired();
    this.games.set(game.gameId, game);
    return game;
  }

  findById(gameId: string): Game | undefined {
    this.pruneExpired();
    return this.games.get(gameId);
  }

  findByJoinCode(joinCode: string): Game | undefined {
    this.pruneExpired();
    return Array.from(this.games.values()).find((game) => game.joinCode === joinCode.toUpperCase());
  }

  delete(gameId: string): boolean {
    return this.games.delete(gameId);
  }

  listGames(): GameSummary[] {
    this.pruneExpired();
    const now = Date.now();
    return Array.from(this.games.values())
      .map((game) => this.toSummary(game, now))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  getTtlConfig(): RepositoryTtlConfig {
    return this.ttlConfig;
  }

  updateTtlConfig(nextConfig: RepositoryTtlConfig): RepositoryTtlConfig {
    this.ttlConfig = nextConfig;
    this.pruneExpired();
    return this.ttlConfig;
  }

  pruneExpired(now = Date.now()): number {
    let deleted = 0;
    for (const game of this.games.values()) {
      const expiresAt = this.getExpiresAtMs(game);
      if (expiresAt <= now) {
        this.games.delete(game.gameId);
        deleted += 1;
      }
    }
    return deleted;
  }

  private toSummary(game: Game, now: number): GameSummary {
    const currentPlayer = game.players.find((player) => player.id === game.currentPlayerId) ?? null;
    const winner = game.winner ? game.players.find((player) => player.id === game.winner) ?? null : null;
    return {
      gameId: game.gameId,
      joinCode: game.joinCode,
      gridSize: game.gridSize,
      status: game.status,
      players: game.players.map((player) => ({
        id: player.id,
        name: player.name,
        score: game.scores[player.id] ?? 0,
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
        ? this.ttlConfig.waitingGameTtlMs
        : game.status === "active"
          ? this.ttlConfig.activeGameTtlMs
          : this.ttlConfig.finishedGameTtlMs;
    return Date.parse(game.updatedAt) + ttlMs;
  }
}
