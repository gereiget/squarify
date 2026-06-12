import { Game } from "../domain/types.js";

export class GameRepository {
  private readonly games = new Map<string, Game>();

  save(game: Game): Game {
    this.games.set(game.gameId, game);
    return game;
  }

  findById(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  findByJoinCode(joinCode: string): Game | undefined {
    return Array.from(this.games.values()).find((game) => game.joinCode === joinCode.toUpperCase());
  }

  delete(gameId: string): boolean {
    return this.games.delete(gameId);
  }
}
