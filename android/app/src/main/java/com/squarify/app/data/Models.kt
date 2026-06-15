package com.squarify.app.data

import com.google.gson.annotations.SerializedName

data class PlayerDto(
    @SerializedName("id")
    val id: String,
    @SerializedName("name")
    val name: String
)

data class LineDto(
    @SerializedName("orientation")
    val orientation: String,
    @SerializedName("row")
    val row: Int,
    @SerializedName("col")
    val col: Int,
    @SerializedName("claimedBy")
    val claimedBy: String
)

data class BoxDto(
    @SerializedName("row")
    val row: Int,
    @SerializedName("col")
    val col: Int,
    @SerializedName("claimedBy")
    val claimedBy: String
)

data class GameDto(
    @SerializedName("gameId")
    val gameId: String,
    @SerializedName("joinCode")
    val joinCode: String,
    @SerializedName("gridSize")
    val gridSize: Int,
    @SerializedName("players")
    val players: List<PlayerDto>,
    @SerializedName("currentPlayerId")
    val currentPlayerId: String,
    @SerializedName("lines")
    val lines: List<LineDto>,
    @SerializedName("boxes")
    val boxes: List<BoxDto>,
    @SerializedName("scores")
    val scores: Map<String, Int>,
    @SerializedName("status")
    val status: String,
    @SerializedName("winner")
    val winner: String?,
    @SerializedName("createdAt")
    val createdAt: String,
    @SerializedName("updatedAt")
    val updatedAt: String
)

data class CreateGameRequest(
    @SerializedName("gridSize")
    val gridSize: Int,
    @SerializedName("playerName")
    val playerName: String
)

data class CreateGameResponse(
    @SerializedName("gameId")
    val gameId: String,
    @SerializedName("joinCode")
    val joinCode: String,
    @SerializedName("playerId")
    val playerId: String,
    @SerializedName("game")
    val game: GameDto
)

data class JoinGameRequest(
    @SerializedName("joinCode")
    val joinCode: String,
    @SerializedName("playerName")
    val playerName: String
)

data class JoinGameResponse(
    @SerializedName("gameId")
    val gameId: String,
    @SerializedName("playerId")
    val playerId: String,
    @SerializedName("game")
    val game: GameDto
)

data class GameResponse(
    @SerializedName("game")
    val game: GameDto
)

data class MoveRequest(
    @SerializedName("playerId")
    val playerId: String,
    @SerializedName("orientation")
    val orientation: String,
    @SerializedName("row")
    val row: Int,
    @SerializedName("col")
    val col: Int
)

data class RestartRequest(
    @SerializedName("playerId")
    val playerId: String
)
