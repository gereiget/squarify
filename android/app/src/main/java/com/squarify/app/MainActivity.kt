package com.squarify.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.squarify.app.audio.GameSoundPlayer
import com.squarify.app.data.OnlineRepository
import com.squarify.app.domain.LocalGameEngine
import com.squarify.app.domain.UiGameState
import com.squarify.app.domain.UiGameStatus
import com.squarify.app.domain.UiLine
import com.squarify.app.domain.toUi
import com.squarify.app.ui.AppShell
import com.squarify.app.ui.theme.SquarifyTheme
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SquarifyTheme {
                val soundPlayer = remember { GameSoundPlayer() }
                val vm: SquarifyViewModel = viewModel()
                LaunchedEffect(vm.soundEvent?.id) {
                    vm.soundEvent?.let(soundPlayer::play)
                }
                DisposableEffect(Unit) {
                    onDispose { soundPlayer.release() }
                }
                AppShell(vm)
            }
        }
    }
}

sealed interface AppScreen {
    data object Menu : AppScreen
    data object LocalSetup : AppScreen
    data object OnlineSetup : AppScreen
    data object Waiting : AppScreen
    data object Game : AppScreen
}

enum class GameMode {
    LOCAL,
    ONLINE
}

enum class SoundCue {
    LINE,
    BOX,
    OTHER_LINE,
    OTHER_BOX
}

data class SoundEvent(
    val id: Long,
    val cue: SoundCue
)

class SquarifyViewModel : ViewModel() {
    private val repository = OnlineRepository()
    private var pollJob: Job? = null
    private var nextSoundId = 0L

    var screen by mutableStateOf<AppScreen>(AppScreen.Menu)
        private set
    var mode by mutableStateOf(GameMode.LOCAL)
        private set
    var gameState by mutableStateOf(UiGameState())
        private set
    var localPlayerId by mutableStateOf("")
        private set
    var loading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    var soundEvent by mutableStateOf<SoundEvent?>(null)
        private set

    fun openLocalSetup() {
        stopPolling()
        errorMessage = null
        mode = GameMode.LOCAL
        screen = AppScreen.LocalSetup
    }

    fun openOnlineSetup() {
        stopPolling()
        errorMessage = null
        mode = GameMode.ONLINE
        screen = AppScreen.OnlineSetup
    }

    fun backToMenu() {
        stopPolling()
        loading = false
        errorMessage = null
        gameState = UiGameState()
        localPlayerId = ""
        screen = AppScreen.Menu
    }

    fun startLocalGame(gridSize: Int, playerOne: String, playerTwo: String) {
        mode = GameMode.LOCAL
        gameState = LocalGameEngine.newGame(gridSize, playerOne, playerTwo)
        localPlayerId = gameState.currentPlayerId
        screen = AppScreen.Game
    }

    fun createOnlineGame(gridSize: Int, playerName: String) {
        loading = true
        errorMessage = null
        viewModelScope.launch {
            runCatching { repository.createGame(gridSize, playerName) }
                .onSuccess { response ->
                    mode = GameMode.ONLINE
                    localPlayerId = response.playerId
                    gameState = response.game.toUi()
                    screen = if (gameState.status == UiGameStatus.WAITING) AppScreen.Waiting else AppScreen.Game
                    startPolling()
                }
                .onFailure { errorMessage = it.message ?: "Could not create game. Check the backend URL and server." }
            loading = false
        }
    }

    fun joinOnlineGame(joinCode: String, playerName: String) {
        loading = true
        errorMessage = null
        viewModelScope.launch {
            runCatching { repository.joinGame(joinCode.uppercase(), playerName) }
                .onSuccess { response ->
                    mode = GameMode.ONLINE
                    localPlayerId = response.playerId
                    gameState = response.game.toUi()
                    screen = AppScreen.Game
                    startPolling()
                }
                .onFailure { errorMessage = it.message ?: "Could not join game. Check the code and server." }
            loading = false
        }
    }

    fun submitMove(line: UiLine) {
        errorMessage = null
        if (mode == GameMode.LOCAL) {
            val previousBoxCount = gameState.boxes.size
            LocalGameEngine.applyMove(gameState, gameState.currentPlayerId, line)
                .onSuccess {
                    gameState = it
                    emitSound(if (it.boxes.size > previousBoxCount) SoundCue.BOX else SoundCue.LINE)
                }
                .onFailure { errorMessage = it.message }
            return
        }

        if (gameState.currentPlayerId != localPlayerId) {
            errorMessage = "Wait for your turn."
            return
        }

        loading = true
        viewModelScope.launch {
            val previousBoxCount = gameState.boxes.size
            runCatching { repository.move(gameState.gameId, localPlayerId, line) }
                .onSuccess {
                    val updated = it.game.toUi()
                    gameState = updated
                    emitSound(if (updated.boxes.size > previousBoxCount) SoundCue.BOX else SoundCue.LINE)
                }
                .onFailure { errorMessage = it.message ?: "Could not submit move." }
            loading = false
        }
    }

    fun restartGame() {
        errorMessage = null
        if (mode == GameMode.LOCAL) {
        val names = gameState.players.map { it.name }
            startLocalGame(gameState.gridSize, names.getOrElse(0) { "Player 1" }, names.getOrElse(1) { "Player 2" })
            return
        }
        loading = true
        viewModelScope.launch {
            runCatching { repository.restart(gameState.gameId, localPlayerId) }
                .onSuccess {
                    gameState = it.game.toUi()
                    screen = if (gameState.status == UiGameStatus.WAITING) AppScreen.Waiting else AppScreen.Game
                }
                .onFailure { errorMessage = it.message ?: "Could not restart game." }
            loading = false
        }
    }

    private fun startPolling() {
        stopPolling()
        pollJob = viewModelScope.launch {
            while (true) {
                if (gameState.gameId.isNotBlank()) {
                    val previous = gameState
                    runCatching { repository.getGame(gameState.gameId) }
                        .onSuccess {
                            val updated = it.game.toUi()
                            if (updated.lines.size > previous.lines.size && updated.lines.lastOrNull()?.claimedBy != localPlayerId) {
                                emitSound(
                                    if (updated.boxes.size > previous.boxes.size) {
                                        SoundCue.OTHER_BOX
                                    } else {
                                        SoundCue.OTHER_LINE
                                    }
                                )
                            }
                            gameState = updated
                            screen = if (gameState.status == UiGameStatus.WAITING) AppScreen.Waiting else AppScreen.Game
                            if (gameState.status != UiGameStatus.WAITING) {
                                errorMessage = null
                            }
                        }
                        .onFailure {
                            errorMessage = "Polling failed. Check if the server is reachable."
                        }
                }
                delay(Config.POLL_INTERVAL_MS)
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
    }

    private fun emitSound(cue: SoundCue) {
        nextSoundId += 1
        soundEvent = SoundEvent(nextSoundId, cue)
    }

    override fun onCleared() {
        stopPolling()
        super.onCleared()
    }
}
