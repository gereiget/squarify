package com.squarify.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.squarify.app.GameMode
import com.squarify.app.SquarifyViewModel
import com.squarify.app.domain.UiGameStatus
import com.squarify.app.domain.UiLine
import com.squarify.app.ui.components.BoardCanvas

@Composable
fun GameScreen(viewModel: SquarifyViewModel) {
    val game = viewModel.gameState
    val currentPlayer = game.players.firstOrNull { it.id == game.currentPlayerId }
    val localPlayer = game.players.firstOrNull { it.id == viewModel.localPlayerId }
    val isMyTurn = viewModel.mode == GameMode.LOCAL || game.currentPlayerId == viewModel.localPlayerId

    ScreenFrame("Game Board", "Tap a free segment to claim it.") {
        viewModel.errorMessage?.let {
            InfoCard { Text(it, color = MaterialTheme.colorScheme.error) }
        }
        if (viewModel.loading) {
            CircularProgressIndicator()
        }
        InfoCard {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Current player: ${currentPlayer?.name ?: "-"}")
                if (viewModel.mode == GameMode.ONLINE) {
                    Text("You are: ${localPlayer?.name ?: "-"}")
                    Text(if (isMyTurn) "Your turn" else "Waiting for opponent")
                }
                Text(
                    game.players.joinToString("  |  ") { player ->
                        "${player.name}: ${game.scores[player.id] ?: 0}"
                    }
                )
                if (game.status == UiGameStatus.FINISHED) {
                    val winner = game.players.firstOrNull { it.id == game.winner }?.name
                    Text(if (winner == null) "Result: draw" else "Winner: $winner")
                }
            }
        }
        BoardCanvas(
            state = game,
            onLineTapped = { line: UiLine ->
                if (game.status == UiGameStatus.ACTIVE) {
                    viewModel.submitMove(line)
                }
            }
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(onClick = viewModel::backToMenu, modifier = Modifier.weight(1f)) {
                Text("Leave")
            }
            Button(onClick = viewModel::restartGame, modifier = Modifier.weight(1f)) {
                Text(if (game.status == UiGameStatus.FINISHED) "Play Again" else "Restart")
            }
        }
    }
}
