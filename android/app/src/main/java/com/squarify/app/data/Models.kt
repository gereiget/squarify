package com.squarify.app.data

data class PlayerDto(
    val id: String,
    val name: String
)

data class LineDto(
    val orientation: String,
    val row: Int,
    val col: Int,
    val claimedBy: String
)

data class BoxDto(
    val row: Int,
    val col: Int,
    val claimedBy: String
)

data class GameDto(
    val gameId: String,
    val joinCode: String,
    val gridSize: Int,
    val players: List<PlayerDto>,
    val currentPlayerId: String,
    val lines: List<LineDto>,
    val boxes: List<BoxDto>,
    val scores: Map<String, Int>,
    val status: String,
    val winner: String?,
    val createdAt: String,
    val updatedAt: String
)

data class CreateGameRequest(
    val gridSize: Int,
    val playerName: String
)

data class CreateGameResponse(
    val gameId: String,
    val joinCode: String,
    val playerId: String,
    val game: GameDto
)

data class JoinGameRequest(
    val joinCode: String,
    val playerName: String
)

data class JoinGameResponse(
    val gameId: String,
    val playerId: String,
    val game: GameDto
)

data class GameResponse(
    val game: GameDto
)

data class MoveRequest(
    val playerId: String,
    val orientation: String,
    val row: Int,
    val col: Int
)

data class RestartRequest(
    val playerId: String
)
