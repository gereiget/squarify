package com.squarify.app.domain

import com.squarify.app.data.BoxDto
import com.squarify.app.data.GameDto
import com.squarify.app.data.LineDto
import com.squarify.app.data.PlayerDto

enum class LineOrientation {
    HORIZONTAL,
    VERTICAL
}

data class UiPlayer(
    val id: String,
    val name: String
)

data class UiLine(
    val orientation: LineOrientation,
    val row: Int,
    val col: Int,
    val claimedBy: String
)

data class UiBox(
    val row: Int,
    val col: Int,
    val claimedBy: String
)

enum class UiGameStatus {
    WAITING,
    ACTIVE,
    FINISHED
}

data class UiGameState(
    val gameId: String = "",
    val joinCode: String = "",
    val gridSize: Int = 3,
    val players: List<UiPlayer> = emptyList(),
    val currentPlayerId: String = "",
    val lines: List<UiLine> = emptyList(),
    val boxes: List<UiBox> = emptyList(),
    val scores: Map<String, Int> = emptyMap(),
    val status: UiGameStatus = UiGameStatus.WAITING,
    val winner: String? = null
)

fun GameDto.toUi(): UiGameState = UiGameState(
    gameId = gameId,
    joinCode = joinCode,
    gridSize = gridSize,
    players = players.map(PlayerDto::toUi),
    currentPlayerId = currentPlayerId,
    lines = lines.map(LineDto::toUi),
    boxes = boxes.map(BoxDto::toUi),
    scores = scores,
    status = when (status) {
        "active" -> UiGameStatus.ACTIVE
        "finished" -> UiGameStatus.FINISHED
        else -> UiGameStatus.WAITING
    },
    winner = winner
)

fun PlayerDto.toUi() = UiPlayer(id = id, name = name)

fun LineDto.toUi() = UiLine(
    orientation = if (orientation == "vertical") LineOrientation.VERTICAL else LineOrientation.HORIZONTAL,
    row = row,
    col = col,
    claimedBy = claimedBy
)

fun BoxDto.toUi() = UiBox(row = row, col = col, claimedBy = claimedBy)
