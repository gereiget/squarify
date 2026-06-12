package com.squarify.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
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
fun LocalSetupScreen(viewModel: SquarifyViewModel) {
    var playerOne by remember { mutableStateOf("Player 1") }
    var playerTwo by remember { mutableStateOf("Player 2") }
    var gridSize by remember { mutableIntStateOf(4) }

    ScreenFrame("Local Match", "Pass the phone after every turn.") {
        InfoCard {
            Text("No backend needed in local mode. All game rules run directly on the device.")
        }
        OutlinedTextField(
            value = playerOne,
            onValueChange = { playerOne = it },
            label = { Text("Player 1 name") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = playerTwo,
            onValueChange = { playerTwo = it },
            label = { Text("Player 2 name") },
            modifier = Modifier.fillMaxWidth()
        )
        GridSizePicker(selected = gridSize, onSelected = { gridSize = it })
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(onClick = viewModel::backToMenu, modifier = Modifier.weight(1f)) {
                Text("Back")
            }
            Button(onClick = { viewModel.startLocalGame(gridSize, playerOne, playerTwo) }, modifier = Modifier.weight(1f)) {
                Text("Start")
            }
        }
    }
}

@Composable
fun GridSizePicker(selected: Int, onSelected: (Int) -> Unit) {
    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
        listOf(3, 4, 5).forEachIndexed { index, size ->
            SegmentedButton(
                selected = selected == size,
                onClick = { onSelected(size) },
                shape = SegmentedButtonDefaults.itemShape(index, 3)
            ) {
                Text("${size}x$size")
            }
        }
    }
}
