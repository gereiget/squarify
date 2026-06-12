package com.squarify.app.domain

object LocalGameEngine {
    fun newGame(gridSize: Int, firstName: String, secondName: String): UiGameState {
        val player1 = UiPlayer("local_p1", firstName.ifBlank { "Player 1" })
        val player2 = UiPlayer("local_p2", secondName.ifBlank { "Player 2" })
        return UiGameState(
            gameId = "local",
            joinCode = "",
            gridSize = gridSize,
            players = listOf(player1, player2),
            currentPlayerId = player1.id,
            lines = emptyList(),
            boxes = emptyList(),
            scores = mapOf(player1.id to 0, player2.id to 0),
            status = UiGameStatus.ACTIVE,
            winner = null
        )
    }

    fun applyMove(state: UiGameState, playerId: String, line: UiLine): Result<UiGameState> {
        if (state.status != UiGameStatus.ACTIVE) return Result.failure(IllegalStateException("The game is not active."))
        if (state.currentPlayerId != playerId) return Result.failure(IllegalStateException("It is not your turn."))
        if (state.lines.any { it.orientation == line.orientation && it.row == line.row && it.col == line.col }) {
            return Result.failure(IllegalStateException("That line is already taken."))
        }
        if (!isInBounds(state.gridSize, line)) return Result.failure(IllegalStateException("Move is outside the board."))

        val updatedLines = state.lines + line
        val completed = candidateBoxes(state.gridSize, line)
            .filter { box -> state.boxes.none { it.row == box.first && it.col == box.second } }
            .filter { (row, col) -> isBoxCompleted(updatedLines, row, col) }
            .map { (row, col) -> UiBox(row, col, playerId) }

        val nextScores = state.scores.toMutableMap().apply {
            if (completed.isNotEmpty()) {
                this[playerId] = (this[playerId] ?: 0) + completed.size
            }
        }
        val nextPlayerId = if (completed.isNotEmpty()) {
            playerId
        } else {
            state.players.first { it.id != playerId }.id
        }
        val nextBoxes = state.boxes + completed
        val finished = nextBoxes.size == state.gridSize * state.gridSize
        val winner = if (!finished) null else {
            val sorted = state.players.sortedByDescending { nextScores[it.id] ?: 0 }
            val first = sorted[0]
            val second = sorted[1]
            if ((nextScores[first.id] ?: 0) == (nextScores[second.id] ?: 0)) null else first.id
        }

        return Result.success(
            state.copy(
                lines = updatedLines,
                boxes = nextBoxes,
                scores = nextScores,
                currentPlayerId = if (finished) state.currentPlayerId else nextPlayerId,
                status = if (finished) UiGameStatus.FINISHED else UiGameStatus.ACTIVE,
                winner = winner
            )
        )
    }

    private fun isInBounds(gridSize: Int, line: UiLine): Boolean {
        return when (line.orientation) {
            LineOrientation.HORIZONTAL -> line.row in 0..gridSize && line.col in 0 until gridSize
            LineOrientation.VERTICAL -> line.row in 0 until gridSize && line.col in 0..gridSize
        }
    }

    private fun candidateBoxes(gridSize: Int, line: UiLine): List<Pair<Int, Int>> {
        val candidates = if (line.orientation == LineOrientation.HORIZONTAL) {
            listOf(line.row - 1 to line.col, line.row to line.col)
        } else {
            listOf(line.row to line.col - 1, line.row to line.col)
        }
        return candidates.filter { (row, col) -> row in 0 until gridSize && col in 0 until gridSize }
    }

    private fun isBoxCompleted(lines: List<UiLine>, row: Int, col: Int): Boolean {
        return hasLine(lines, LineOrientation.HORIZONTAL, row, col) &&
            hasLine(lines, LineOrientation.HORIZONTAL, row + 1, col) &&
            hasLine(lines, LineOrientation.VERTICAL, row, col) &&
            hasLine(lines, LineOrientation.VERTICAL, row, col + 1)
    }

    private fun hasLine(lines: List<UiLine>, orientation: LineOrientation, row: Int, col: Int): Boolean {
        return lines.any { it.orientation == orientation && it.row == row && it.col == col }
    }
}
