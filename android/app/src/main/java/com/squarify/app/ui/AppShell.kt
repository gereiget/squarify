package com.squarify.app.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.squarify.app.AppScreen
import com.squarify.app.SquarifyViewModel
import com.squarify.app.ui.screens.GameScreen
import com.squarify.app.ui.screens.LocalSetupScreen
import com.squarify.app.ui.screens.MainMenuScreen
import com.squarify.app.ui.screens.OnlineSetupScreen
import com.squarify.app.ui.screens.WaitingScreen

@Composable
fun AppShell(viewModel: SquarifyViewModel) {
    Surface(modifier = Modifier.fillMaxSize()) {
        when (viewModel.screen) {
            AppScreen.Menu -> MainMenuScreen(viewModel)
            AppScreen.LocalSetup -> LocalSetupScreen(viewModel)
            AppScreen.OnlineSetup -> OnlineSetupScreen(viewModel)
            AppScreen.Waiting -> WaitingScreen(viewModel)
            AppScreen.Game -> GameScreen(viewModel)
        }
    }
}
