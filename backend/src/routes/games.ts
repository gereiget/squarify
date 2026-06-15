import { Request, Router } from "express";
import { z } from "zod";
import { applyMove, createGame, joinGame, markPlayerSeen, restartGame } from "../domain/gameEngine.js";
import { GameRepository } from "../repository/gameRepository.js";

const createSchema = z.object({
  gridSize: z.number().int().min(3).max(5),
  playerName: z.string().trim().min(1).max(30)
});

const joinSchema = z.object({
  joinCode: z.string().trim().min(4).max(12),
  playerName: z.string().trim().min(1).max(30)
});

const moveSchema = z.object({
  playerId: z.string().trim().min(1),
  orientation: z.enum(["horizontal", "vertical"]),
  row: z.number().int().min(0),
  col: z.number().int().min(0)
});

const restartSchema = z.object({
  playerId: z.string().trim().min(1).optional()
});

function serializeGame(game: ReturnType<GameRepository["findById"]>) {
  return game;
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]?.trim()) {
    return forwarded[0].split(",")[0].trim();
  }
  return req.ip || null;
}

export function createGamesRouter(repository: GameRepository): Router {
  const router = Router();

  router.post("/", (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body.", details: parsed.error.flatten() });
    }

    try {
      const { game, playerId } = createGame(parsed.data.gridSize, parsed.data.playerName, getClientIp(req));
      repository.save(game);
      return res.status(201).json({
        gameId: game.gameId,
        joinCode: game.joinCode,
        playerId,
        game: serializeGame(game)
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create game." });
    }
  });

  router.post("/join", (req, res) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body.", details: parsed.error.flatten() });
    }

    const game = repository.findByJoinCode(parsed.data.joinCode);
    if (!game) {
      return res.status(404).json({ error: "Game not found for that join code." });
    }

    try {
      const result = joinGame(game, parsed.data.playerName, getClientIp(req));
      repository.save(result.game);
      return res.json({
        gameId: result.game.gameId,
        playerId: result.playerId,
        game: serializeGame(result.game)
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to join game." });
    }
  });

  router.get("/:gameId", (req, res) => {
    const game = repository.findById(req.params.gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found." });
    }
    const playerId = typeof req.query.playerId === "string" ? req.query.playerId : null;
    if (playerId) {
      repository.save(markPlayerSeen(game, playerId, getClientIp(req)));
    }
    return res.json({ game: serializeGame(game) });
  });

  router.post("/:gameId/move", (req, res) => {
    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body.", details: parsed.error.flatten() });
    }
    const game = repository.findById(req.params.gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found." });
    }

    try {
      markPlayerSeen(game, parsed.data.playerId, getClientIp(req));
      const updated = applyMove(game, parsed.data);
      repository.save(updated);
      return res.json({ game: serializeGame(updated) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to apply move." });
    }
  });

  router.post("/:gameId/restart", (req, res) => {
    const parsed = restartSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body.", details: parsed.error.flatten() });
    }
    const game = repository.findById(req.params.gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found." });
    }
    repository.archiveForRestart(game.gameId);
    if (parsed.data.playerId) {
      markPlayerSeen(game, parsed.data.playerId, getClientIp(req));
    }
    repository.save(restartGame(game));
    return res.json({ game });
  });

  router.delete("/:gameId", (req, res) => {
    const deleted = repository.delete(req.params.gameId);
    return res.status(deleted ? 204 : 404).send();
  });

  return router;
}
