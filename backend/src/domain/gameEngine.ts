import { Box, Game, Line, MoveInput, Player } from "./types.js";
import { createId, createJoinCode } from "../utils/ids.js";

const GRID_SIZES = new Set([3, 4, 5]);

function timestamp(): string {
  return new Date().toISOString();
}

function hasLine(lines: Line[], orientation: "horizontal" | "vertical", row: number, col: number): boolean {
  return lines.some((line) => line.orientation === orientation && line.row === row && line.col === col);
}

function validateLineBounds(gridSize: number, orientation: "horizontal" | "vertical", row: number, col: number): void {
  const rowMax = orientation === "horizontal" ? gridSize : gridSize - 1;
  const colMax = orientation === "horizontal" ? gridSize - 1 : gridSize;
  if (row < 0 || col < 0 || row > rowMax || col > colMax) {
    throw new Error("Line coordinates are outside the board.");
  }
}

function isBoxCompleted(lines: Line[], row: number, col: number): boolean {
  return (
    hasLine(lines, "horizontal", row, col) &&
    hasLine(lines, "horizontal", row + 1, col) &&
    hasLine(lines, "vertical", row, col) &&
    hasLine(lines, "vertical", row, col + 1)
  );
}

function listCompletedBoxes(game: Game, move: MoveInput): Box[] {
  const candidates =
    move.orientation === "horizontal"
      ? [
          { row: move.row - 1, col: move.col },
          { row: move.row, col: move.col }
        ]
      : [
          { row: move.row, col: move.col - 1 },
          { row: move.row, col: move.col }
        ];

  return candidates
    .filter(({ row, col }) => row >= 0 && col >= 0 && row < game.gridSize && col < game.gridSize)
    .filter(({ row, col }) => !game.boxes.some((box) => box.row === row && box.col === col))
    .filter(({ row, col }) => isBoxCompleted(game.lines, row, col))
    .map(({ row, col }) => ({ row, col, claimedBy: move.playerId }));
}

export function createGame(gridSize: number, playerName: string): { game: Game; playerId: string } {
  if (!GRID_SIZES.has(gridSize)) {
    throw new Error("Grid size must be 3, 4, or 5.");
  }
  const firstPlayer: Player = {
    id: createId("player"),
    name: playerName.trim() || "Player 1"
  };
  const now = timestamp();
  const game: Game = {
    gameId: createId("game"),
    joinCode: createJoinCode(),
    gridSize,
    players: [firstPlayer],
    currentPlayerId: firstPlayer.id,
    lines: [],
    boxes: [],
    scores: { [firstPlayer.id]: 0 },
    status: "waiting",
    winner: null,
    createdAt: now,
    updatedAt: now
  };

  return { game, playerId: firstPlayer.id };
}

export function joinGame(game: Game, playerName: string): { game: Game; playerId: string } {
  if (game.status !== "waiting") {
    throw new Error("This game is not accepting new players.");
  }
  if (game.players.length >= 2) {
    throw new Error("This game is already full.");
  }
  const player: Player = {
    id: createId("player"),
    name: playerName.trim() || "Player 2"
  };
  game.players.push(player);
  game.scores[player.id] = 0;
  game.status = "active";
  game.updatedAt = timestamp();
  return { game, playerId: player.id };
}

export function applyMove(game: Game, move: MoveInput): Game {
  if (game.status !== "active") {
    throw new Error("The game is not active.");
  }
  if (!game.players.some((player) => player.id === move.playerId)) {
    throw new Error("Unknown player.");
  }
  if (game.currentPlayerId !== move.playerId) {
    throw new Error("It is not this player's turn.");
  }

  validateLineBounds(game.gridSize, move.orientation, move.row, move.col);
  if (hasLine(game.lines, move.orientation, move.row, move.col)) {
    throw new Error("This line has already been claimed.");
  }

  game.lines.push({
    orientation: move.orientation,
    row: move.row,
    col: move.col,
    claimedBy: move.playerId
  });

  const completed = listCompletedBoxes(game, move);
  if (completed.length > 0) {
    game.boxes.push(...completed);
    game.scores[move.playerId] = (game.scores[move.playerId] ?? 0) + completed.length;
  } else {
    const currentIndex = game.players.findIndex((player) => player.id === move.playerId);
    const nextIndex = (currentIndex + 1) % game.players.length;
    game.currentPlayerId = game.players[nextIndex].id;
  }

  if (game.boxes.length === game.gridSize * game.gridSize) {
    game.status = "finished";
    const [first, second] = game.players;
    const firstScore = game.scores[first.id] ?? 0;
    const secondScore = game.scores[second.id] ?? 0;
    game.winner = firstScore === secondScore ? null : firstScore > secondScore ? first.id : second.id;
  }

  game.updatedAt = timestamp();
  return game;
}

export function restartGame(game: Game): Game {
  game.lines = [];
  game.boxes = [];
  game.winner = null;
  game.status = game.players.length < 2 ? "waiting" : "active";
  game.currentPlayerId = game.players[0]?.id ?? "";
  game.scores = Object.fromEntries(game.players.map((player) => [player.id, 0]));
  game.updatedAt = timestamp();
  return game;
}
