export type Orientation = "horizontal" | "vertical";
export type GameStatus = "waiting" | "active" | "finished";

export interface Player {
  id: string;
  name: string;
}

export interface Line {
  orientation: Orientation;
  row: number;
  col: number;
  claimedBy: string;
}

export interface Box {
  row: number;
  col: number;
  claimedBy: string;
}

export interface Scores {
  [playerId: string]: number;
}

export interface Game {
  gameId: string;
  joinCode: string;
  gridSize: number;
  players: Player[];
  currentPlayerId: string;
  lines: Line[];
  boxes: Box[];
  scores: Scores;
  status: GameStatus;
  winner: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MoveInput {
  playerId: string;
  orientation: Orientation;
  row: number;
  col: number;
}
