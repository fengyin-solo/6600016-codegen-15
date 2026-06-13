export interface MorseSymbol {
  char: string
  code: string
}

export type TrainMode = 'charToCode' | 'codeToChar' | 'audioToChar' | 'typingToCode'

export interface HistoryEntry {
  id: number
  input: string
  output: string
  correct: boolean
  timestamp: number
}

export interface ShortcutPreset {
  id: string
  key: string
  label: string
  message: string
  morse: string
}

export interface PlaybackSegment {
  type: 'dot' | 'dash' | 'symbolGap' | 'letterGap' | 'wordGap'
  duration: number
  startTime: number
}

export interface TelegraphLog {
  id: number
  preset: ShortcutPreset
  timestamp: number
  segments: PlaybackSegment[]
}
