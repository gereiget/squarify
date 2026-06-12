package com.squarify.app.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    @POST("api/games")
    suspend fun createGame(@Body request: CreateGameRequest): CreateGameResponse

    @POST("api/games/join")
    suspend fun joinGame(@Body request: JoinGameRequest): JoinGameResponse

    @GET("api/games/{gameId}")
    suspend fun getGame(@Path("gameId") gameId: String): GameResponse

    @POST("api/games/{gameId}/move")
    suspend fun submitMove(@Path("gameId") gameId: String, @Body request: MoveRequest): GameResponse

    @POST("api/games/{gameId}/restart")
    suspend fun restartGame(@Path("gameId") gameId: String, @Body request: RestartRequest): GameResponse
}
