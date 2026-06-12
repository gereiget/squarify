package com.squarify.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = androidx.compose.ui.graphics.Color(0xFFB45309),
    secondary = androidx.compose.ui.graphics.Color(0xFF0F766E),
    tertiary = androidx.compose.ui.graphics.Color(0xFF1D4ED8),
    background = androidx.compose.ui.graphics.Color(0xFFFFFBF5),
    surface = androidx.compose.ui.graphics.Color(0xFFFFFFFF)
)

private val DarkColors = darkColorScheme(
    primary = androidx.compose.ui.graphics.Color(0xFFF59E0B),
    secondary = androidx.compose.ui.graphics.Color(0xFF5EEAD4),
    tertiary = androidx.compose.ui.graphics.Color(0xFF93C5FD)
)

@Composable
fun SquarifyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = Typography,
        content = content
    )
}
