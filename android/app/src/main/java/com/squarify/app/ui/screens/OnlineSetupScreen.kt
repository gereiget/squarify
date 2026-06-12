package com.squarify.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.squarify.app.SquarifyViewModel

@Composable
fun OnlineSetupScreen(viewModel: SquarifyViewModel) {
    var hostName by remember { mutableStateOf("Host") }
    var joinName by remember { mutableStateOf("Guest") }
    var joinCode by remember { mutableStateOf("") }
    var gridSize by remember { mutableIntStateOf(4) }

    ScreenFrame("Online Match", "Create a room or join one with a code.") {
        if (viewModel.loading) {
            CircularProgressIndicator()
        }
        viewModel.errorMessage?.let {
            InfoCard { Text(it) }
        }
        InfoCard {
            Text("The app polls the backend every ${com.squarify.app.Config.POLL_INTERVAL_MS / 1000.0} seconds.")
        }
        Text("Create Game")
        OutlinedTextField(
            value = hostName,
            onValueChange = { hostName = it },
            label = { Text("Your name") },
            modifier = Modifier.fillMaxWidth()
        )
        GridSizePicker(selected = gridSize, onSelected = { gridSize = it })
        Button(
            onClick = { viewModel.createOnlineGame(gridSize, hostName) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Create Online Game")
        }

        Text("Join Game")
        OutlinedTextField(
            value = joinName,
            onValueChange = { joinName = it },
            label = { Text("Your name") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = joinCode,
            onValueChange = { joinCode = it.uppercase() },
            label = { Text("Join code") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = { viewModel.joinOnlineGame(joinCode, joinName) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Join Online Game")
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(onClick = viewModel::backToMenu, modifier = Modifier.weight(1f)) {
                Text("Back")
            }
        }
    }
}
