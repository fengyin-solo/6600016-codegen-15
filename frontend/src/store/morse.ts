import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { MORSE_TABLE, REVERSE_TABLE, textToMorse, morseToText } from '../utils/morse-code'
import type { TrainMode, HistoryEntry, ShortcutPreset, PlaybackSegment, TelegraphLog } from '../types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

const DEFAULT_PRESETS: ShortcutPreset[] = [
  { id: generateId(), key: '1', label: 'SOS', message: 'SOS', morse: '... --- ...' },
  { id: generateId(), key: '2', label: 'CQ', message: 'CQ', morse: '-.-. --.-' },
  { id: generateId(), key: '3', label: 'OK', message: 'OK', morse: '--- -.-' },
  { id: generateId(), key: '4', label: 'OVER', message: 'OVER', morse: '--- ...- . .-.' },
  { id: generateId(), key: '5', label: 'OUT', message: 'OUT', morse: '--- ..- -' },
  { id: generateId(), key: '6', label: 'HELLO', message: 'HELLO', morse: '.... . .-.. .-.. ---' },
]

export const useMorseStore = defineStore('morse', () => {
  const inputText = ref('')
  const morseOutput = ref('')
  const decodedText = ref('')
  const wpm = ref(15)
  const frequency = ref(700)
  const volume = ref(0.6)
  const trainMode = ref<TrainMode>('charToCode')
  const history = ref<HistoryEntry[]>([])
  const quizChar = ref('')
  const userAnswer = ref('')
  const score = ref({ correct: 0, total: 0 })
  const isPlaying = ref(false)
  let audioCtx: AudioContext | null = null
  let currentOscillator: OscillatorNode | null = null

  const shortcuts = ref<ShortcutPreset[]>([...DEFAULT_PRESETS])
  const telegraphLogs = ref<TelegraphLog[]>([])
  const activeShortcutId = ref<string | null>(null)
  const playbackProgress = ref(0)
  const isTelegraphPlaying = ref(false)
  let playbackTimer: ReturnType<typeof setTimeout> | null = null

  const dotDuration = computed(() => 1200 / wpm.value)

  function getAudioCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  }

  function playTone(duration: number): Promise<void> {
    return new Promise(resolve => {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency.value
      gain.gain.value = volume.value
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      currentOscillator = osc
      setTimeout(() => { osc.stop(); currentOscillator = null; resolve() }, duration)
    })
  }

  async function playMorse(morse: string) {
    isPlaying.value = true
    const dd = dotDuration.value
    for (const token of morse.split(' ')) {
      if (token === '/') { await sleep(dd * 7); continue }
      for (const sym of token) {
        await playTone(sym === '.' ? dd : dd * 3)
        await sleep(dd)
      }
      await sleep(dd * 2)
    }
    isPlaying.value = false
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }

  function encode() {
    morseOutput.value = textToMorse(inputText.value)
  }

  function decode() {
    decodedText.value = morseToText(inputText.value)
  }

  function generateQuiz() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    quizChar.value = chars[Math.floor(Math.random() * chars.length)]
    userAnswer.value = ''
  }

  function checkAnswer() {
    const correct = userAnswer.value.trim() === MORSE_TABLE[quizChar.value]
    score.value.total++
    if (correct) score.value.correct++
    history.value.unshift({
      id: Date.now(), input: quizChar.value, output: userAnswer.value,
      correct, timestamp: Date.now()
    })
    generateQuiz()
  }

  function resetScore() {
    score.value = { correct: 0, total: 0 }
    history.value = []
  }

  function buildPlaybackSegments(morse: string): PlaybackSegment[] {
    const dd = dotDuration.value
    const segments: PlaybackSegment[] = []
    let time = 0
    const tokens = morse.split(' ')
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token === '/') {
        segments.push({ type: 'wordGap', duration: dd * 7, startTime: time })
        time += dd * 7
        continue
      }
      for (let j = 0; j < token.length; j++) {
        const sym = token[j]
        if (sym === '.') {
          segments.push({ type: 'dot', duration: dd, startTime: time })
          time += dd
        } else if (sym === '-') {
          segments.push({ type: 'dash', duration: dd * 3, startTime: time })
          time += dd * 3
        }
        if (j < token.length - 1) {
          segments.push({ type: 'symbolGap', duration: dd, startTime: time })
          time += dd
        }
      }
      if (i < tokens.length - 1 && tokens[i + 1] !== '/') {
        segments.push({ type: 'letterGap', duration: dd * 3, startTime: time })
        time += dd * 3
      }
    }
    return segments
  }

  async function sendShortcut(preset: ShortcutPreset) {
    if (isTelegraphPlaying.value) return
    const segments = buildPlaybackSegments(preset.morse)
    const log: TelegraphLog = {
      id: Date.now(),
      preset,
      timestamp: Date.now(),
      segments: [...segments],
    }
    telegraphLogs.value.unshift(log)
    if (telegraphLogs.value.length > 20) telegraphLogs.value.length = 20

    activeShortcutId.value = preset.id
    isTelegraphPlaying.value = true
    playbackProgress.value = 0

    const totalDuration = segments.length > 0
      ? segments[segments.length - 1].startTime + segments[segments.length - 1].duration
      : 0

    const startTime = performance.now()
    const animate = () => {
      const elapsed = performance.now() - startTime
      playbackProgress.value = Math.min(elapsed / totalDuration, 1)
      if (elapsed < totalDuration && isTelegraphPlaying.value) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)

    await playMorse(preset.morse)

    isTelegraphPlaying.value = false
    activeShortcutId.value = null
    playbackProgress.value = 1
  }

  function addShortcut(key: string, label: string, message: string) {
    const morse = textToMorse(message)
    shortcuts.value.push({
      id: generateId(),
      key,
      label,
      message,
      morse,
    })
  }

  function removeShortcut(id: string) {
    shortcuts.value = shortcuts.value.filter(s => s.id !== id)
  }

  function updateShortcut(id: string, key: string, label: string, message: string) {
    const idx = shortcuts.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      shortcuts.value[idx] = {
        ...shortcuts.value[idx],
        key,
        label,
        message,
        morse: textToMorse(message),
      }
    }
  }

  function clearLogs() {
    telegraphLogs.value = []
  }

  return {
    inputText, morseOutput, decodedText, wpm, frequency, volume,
    trainMode, history, quizChar, userAnswer, score, isPlaying,
    dotDuration, encode, decode, playMorse, playTone,
    generateQuiz, checkAnswer, resetScore,
    shortcuts, telegraphLogs, activeShortcutId, playbackProgress, isTelegraphPlaying,
    sendShortcut, addShortcut, removeShortcut, updateShortcut, clearLogs,
    buildPlaybackSegments,
  }
})
