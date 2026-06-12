package com.squarify.app.audio

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import com.squarify.app.SoundCue
import com.squarify.app.SoundEvent

class GameSoundPlayer {
    private val toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 80)
    private val handler = Handler(Looper.getMainLooper())

    fun play(event: SoundEvent) {
        when (event.cue) {
            SoundCue.LINE -> playLineTick()
            SoundCue.BOX -> playBoxTick()
            SoundCue.OTHER_LINE -> playOtherLineTick()
            SoundCue.OTHER_BOX -> playOtherBoxTick()
        }
    }

    fun release() {
        handler.removeCallbacksAndMessages(null)
        toneGenerator.release()
    }

    private fun playLineTick() {
        toneGenerator.startTone(ToneGenerator.TONE_DTMF_1, 45)
    }

    private fun playBoxTick() {
        toneGenerator.startTone(ToneGenerator.TONE_DTMF_6, 55)
        handler.postDelayed(
            { toneGenerator.startTone(ToneGenerator.TONE_DTMF_9, 70) },
            85L
        )
    }

    private fun playOtherLineTick() {
        toneGenerator.startTone(ToneGenerator.TONE_DTMF_3, 45)
    }

    private fun playOtherBoxTick() {
        toneGenerator.startTone(ToneGenerator.TONE_DTMF_7, 55)
        handler.postDelayed(
            { toneGenerator.startTone(ToneGenerator.TONE_DTMF_0, 75) },
            85L
        )
    }
}
