package com.squarify.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import com.squarify.app.SquarifyViewModel

@Composable
fun WaitingScreen(viewModel: SquarifyViewModel) {
    val game = viewModel.gameState
    ScreenFrame("Waiting for Opponent", "Share this join code with the second player.") {
        InfoCard {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Join code: ${game.joinCode}")
                Text("Game ID: ${game.gameId}")
                Text("Players joined: ${game.players.size}/2")
            }
        }
        CircularProgressIndicator()
        viewModel.errorMessage?.let {
            InfoCard { Text(it) }
        }
        Button(onClick = viewModel::backToMenu, modifier = Modifier.fillMaxWidth()) {
            Text("Leave Lobby")
        }
    }
}
