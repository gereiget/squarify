package com.squarify.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.squarify.app.domain.LineOrientation
import com.squarify.app.domain.UiGameState
import com.squarify.app.domain.UiLine
import kotlin.math.abs

@Composable
fun BoardCanvas(
    state: UiGameState,
    onLineTapped: (UiLine) -> Unit,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .background(Color(0xFFF8F3EA), RoundedCornerShape(24.dp))
            .pointerInput(state) {
                detectTapGestures { offset ->
                    detectLineTap(state, size.width.toFloat(), size.height.toFloat(), offset)?.let(onLineTapped)
                }
            }
    ) {
        val gridSize = state.gridSize
        val padding = size.minDimension * 0.12f
        val cell = (size.minDimension - padding * 2f) / gridSize.toFloat()

        state.boxes.forEach { box ->
            val left = padding + box.col.toFloat() * cell
            val top = padding + box.row.toFloat() * cell
            val ownerIndex = state.players.indexOfFirst { it.id == box.claimedBy }
            val color = if (ownerIndex == 0) Color(0xFFD96C06) else Color(0xFF176087)
            drawRect(color.copy(alpha = 0.22f), topLeft = Offset(left + 12f, top + 12f), size = androidx.compose.ui.geometry.Size(cell - 24f, cell - 24f))
        }

        for (line in state.lines) {
            val color = if (state.players.firstOrNull()?.id == line.claimedBy) Color(0xFFD96C06) else Color(0xFF176087)
            val (start, end) = lineOffsets(line.orientation, line.row, line.col, padding, cell)
            drawLine(color = color, start = start, end = end, strokeWidth = 14f)
        }

        for (row in 0..gridSize) {
            for (col in 0..gridSize) {
                drawCircle(
                    color = Color(0xFF1C1B1A),
                    radius = 10f,
                    center = Offset(padding + col.toFloat() * cell, padding + row.toFloat() * cell)
                )
            }
        }

        for (row in 0..gridSize) {
            for (col in 0 until gridSize) {
                if (state.lines.none { it.orientation == LineOrientation.HORIZONTAL && it.row == row && it.col == col }) {
                    val (start, end) = lineOffsets(LineOrientation.HORIZONTAL, row, col, padding, cell)
                    drawLine(Color(0x55212121), start, end, strokeWidth = 4f, cap = StrokeCap.Round)
                }
            }
        }

        for (row in 0 until gridSize) {
            for (col in 0..gridSize) {
                if (state.lines.none { it.orientation == LineOrientation.VERTICAL && it.row == row && it.col == col }) {
                    val (start, end) = lineOffsets(LineOrientation.VERTICAL, row, col, padding, cell)
                    drawLine(Color(0x55212121), start, end, strokeWidth = 4f, cap = StrokeCap.Round)
                }
            }
        }
    }
}

private fun lineOffsets(
    orientation: LineOrientation,
    row: Int,
    col: Int,
    padding: Float,
    cell: Float
): Pair<Offset, Offset> {
    return if (orientation == LineOrientation.HORIZONTAL) {
        Offset(padding + col.toFloat() * cell, padding + row.toFloat() * cell) to
            Offset(padding + (col + 1).toFloat() * cell, padding + row.toFloat() * cell)
    } else {
        Offset(padding + col.toFloat() * cell, padding + row.toFloat() * cell) to
            Offset(padding + col.toFloat() * cell, padding + (row + 1).toFloat() * cell)
    }
}

private fun detectLineTap(state: UiGameState, width: Float, height: Float, tap: Offset): UiLine? {
    val padding = minOf(width, height) * 0.12f
    val cell = (minOf(width, height) - padding * 2f) / state.gridSize.toFloat()
    val threshold = cell * 0.22f

    fun distanceToSegment(start: Offset, end: Offset): Float {
        val dx = end.x - start.x
        val dy = end.y - start.y
        val lengthSquared = dx * dx + dy * dy
        if (lengthSquared == 0f) return (tap - start).getDistance()
        val t = (((tap.x - start.x) * dx + (tap.y - start.y) * dy) / lengthSquared).coerceIn(0f, 1f)
        val projection = Offset(start.x + t * dx, start.y + t * dy)
        return (tap - projection).getDistance()
    }

    val candidates = buildList {
        for (row in 0..state.gridSize) {
            for (col in 0 until state.gridSize) {
                add(UiLine(LineOrientation.HORIZONTAL, row, col, state.currentPlayerId))
            }
        }
        for (row in 0 until state.gridSize) {
            for (col in 0..state.gridSize) {
                add(UiLine(LineOrientation.VERTICAL, row, col, state.currentPlayerId))
            }
        }
    }.filterNot { candidate ->
        state.lines.any { it.orientation == candidate.orientation && it.row == candidate.row && it.col == candidate.col }
    }

    return candidates.minByOrNull { candidate ->
        val (start, end) = lineOffsets(candidate.orientation, candidate.row, candidate.col, padding, cell)
        distanceToSegment(start, end)
    }?.takeIf {
        val (start, end) = lineOffsets(it.orientation, it.row, it.col, padding, cell)
        distanceToSegment(start, end) <= threshold &&
            if (it.orientation == LineOrientation.HORIZONTAL) abs(tap.x - (start.x + end.x) / 2) <= cell * 0.6f else abs(tap.y - (start.y + end.y) / 2) <= cell * 0.6f
    }
}
