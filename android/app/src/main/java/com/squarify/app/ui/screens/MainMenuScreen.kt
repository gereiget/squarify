package com.squarify.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.squarify.app.Config
import com.squarify.app.SquarifyViewModel

@Composable
fun MainMenuScreen(viewModel: SquarifyViewModel) {
    ScreenFrame(
        title = "Squarify",
        subtitle = "Dots and Boxes for two players, locally or online."
    ) {
        InfoCard {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Play head-to-head on one phone or host a live match through your VPS backend.")
                Text("Choose 3x3, 4x4, or 5x5 boards and let the backend enforce every rule online.")
            }
        }
        Button(onClick = viewModel::openLocalSetup, modifier = Modifier.fillMaxWidth()) {
            Text("Local Two-Player")
        }
        Button(onClick = viewModel::openOnlineSetup, modifier = Modifier.fillMaxWidth()) {
            Text("Online Multiplayer")
        }
        Text(
            "Backend URL: ${Config.BASE_URL}",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
