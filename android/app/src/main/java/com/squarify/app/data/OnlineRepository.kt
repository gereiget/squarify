package com.squarify.app.data

import com.squarify.app.Config
import com.squarify.app.domain.UiLine
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class OnlineRepository {
    private val api = Retrofit.Builder()
        .baseUrl(Config.BASE_URL)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(ApiService::class.java)

    suspend fun createGame(gridSize: Int, playerName: String) =
        api.createGame(CreateGameRequest(gridSize, playerName))

    suspend fun joinGame(joinCode: String, playerName: String) =
        api.joinGame(JoinGameRequest(joinCode, playerName))

    suspend fun getGame(gameId: String) = api.getGame(gameId)

    suspend fun move(gameId: String, playerId: String, line: UiLine) =
        api.submitMove(gameId, MoveRequest(playerId, line.orientation.name.lowercase(), line.row, line.col))

    suspend fun restart(gameId: String, playerId: String) =
        api.restartGame(gameId, RestartRequest(playerId))
}
