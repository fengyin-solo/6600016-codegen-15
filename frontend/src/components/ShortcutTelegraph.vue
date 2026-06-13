<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-gray-900 rounded-xl p-4">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-amber-300 font-bold">快捷发报台</h3>
          <button @click="showAddForm = !showAddForm"
            class="text-sm px-3 py-1 rounded bg-amber-500 text-black hover:bg-amber-400">
            {{ showAddForm ? '取消' : '+ 新增' }}
          </button>
        </div>

        <div v-if="showAddForm" class="bg-gray-800 rounded-lg p-3 mb-3 flex flex-col gap-2">
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="text-gray-400 text-xs">快捷键 (Alt+)</label>
              <select v-model="newKey" class="w-full bg-gray-700 rounded px-2 py-1 text-white text-sm"
                :disabled="availableKeys.length === 0">
                <option v-for="k in availableKeys" :key="k" :value="k">{{ k }}</option>
              </select>
              <p v-if="availableKeys.length === 0" class="text-xs text-red-400 mt-1">
                所有键位已占用，请先删除一个预设
              </p>
            </div>
            <div class="flex-1">
              <label class="text-gray-400 text-xs">标签</label>
              <input v-model="newLabel" class="w-full bg-gray-700 rounded px-2 py-1 text-white text-sm"
                placeholder="如: SOS" />
            </div>
          </div>
          <div>
            <label class="text-gray-400 text-xs">报文内容</label>
            <input v-model="newMessage" class="w-full bg-gray-700 rounded px-2 py-1 text-white text-sm"
              placeholder="如: SOS" @keyup.enter="handleAdd" />
          </div>
          <p v-if="addError" class="text-xs text-red-400">{{ addError }}</p>
          <button @click="handleAdd" :disabled="!newKey || !newMessage || availableKeys.length === 0"
            class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-500 disabled:opacity-40">
            确认添加
          </button>
        </div>

        <div class="flex flex-col gap-2 max-h-96 overflow-y-auto">
          <div v-for="preset in store.shortcuts" :key="preset.id"
            class="flex items-center gap-2 bg-gray-800 rounded-lg p-3 group transition-all"
            :class="{
              'ring-2 ring-amber-400 bg-amber-900/30': store.activeShortcutId === preset.id,
              'animate-pulse': store.activeShortcutId === preset.id && store.isTelegraphPlaying,
            }">
            <kbd class="px-2 py-1 bg-gray-700 rounded text-amber-400 font-mono text-sm min-w-[3rem] text-center border border-gray-600">
              Alt+{{ preset.key }}
            </kbd>
            <div class="flex-1 min-w-0">
              <div class="text-white font-bold text-sm truncate">{{ preset.label }}</div>
              <div class="text-green-400 font-mono text-xs truncate">{{ preset.morse }}</div>
            </div>
            <button @click="store.sendShortcut(preset)" :disabled="store.isTelegraphPlaying"
              class="px-3 py-1 bg-amber-500 text-black rounded text-xs font-bold hover:bg-amber-400 disabled:opacity-40">
              发送
            </button>
            <button @click="store.removeShortcut(preset.id)"
              class="px-2 py-1 text-red-400 text-xs opacity-0 group-hover:opacity-100 hover:underline">
              删除
            </button>
          </div>
          <div v-if="store.shortcuts.length === 0" class="text-gray-500 text-center py-4 text-sm">
            暂无快捷预设，请点击上方"新增"添加
          </div>
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
        <h3 class="text-amber-300 font-bold">发送节奏回放</h3>

        <div class="relative bg-black rounded-lg overflow-hidden" style="height: 120px;">
          <canvas ref="rhythmCanvas" class="w-full h-full" />
          <div v-if="store.isTelegraphPlaying"
            class="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
            发送中
          </div>
        </div>

        <div v-if="currentPlayback" class="bg-gray-800 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-amber-400 font-bold">{{ currentPlayback.preset.label }}</span>
            <span class="text-gray-500 text-sm">Alt+{{ currentPlayback.preset.key }}</span>
          </div>
          <div class="font-mono text-green-400 text-sm">{{ currentPlayback.preset.morse }}</div>
          <div class="text-gray-400 text-xs mt-1">
            {{ new Date(currentPlayback.timestamp).toLocaleTimeString() }}
            · {{ currentPlayback.segments.filter(s => s.type === 'dot' || s.type === 'dash').length }} 个信号
          </div>
        </div>
        <div v-else class="bg-gray-800 rounded-lg p-3 text-center text-gray-500 text-sm">
          按下快捷键发送报码后，此处将显示节奏回放
        </div>
      </div>
    </div>

    <div class="bg-gray-900 rounded-xl p-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-amber-300 font-bold">发送记录</h3>
        <button @click="store.clearLogs()" class="text-red-400 text-sm hover:underline">清空</button>
      </div>
      <div v-if="store.telegraphLogs.length === 0" class="text-gray-500 text-center py-4 text-sm">
        暂无发送记录
      </div>
      <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
        <div v-for="log in store.telegraphLogs" :key="log.id"
          class="flex items-center gap-3 bg-gray-800 rounded px-3 py-2 text-sm cursor-pointer hover:bg-gray-700"
          @click="selectLog(log)">
          <span class="text-amber-400 font-bold min-w-[4rem]">{{ log.preset.label }}</span>
          <span class="font-mono text-green-400 flex-1 truncate">{{ log.preset.morse }}</span>
          <span class="text-gray-500 text-xs">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
          <button @click.stop="replayLog(log)" :disabled="store.isTelegraphPlaying"
            class="text-amber-400 hover:underline disabled:opacity-40 text-xs">
            回放
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useMorseStore } from '../store/morse'
import type { TelegraphLog } from '../types'

const store = useMorseStore()

const showAddForm = ref(false)
const newKey = ref('')
const newLabel = ref('')
const newMessage = ref('')
const rhythmCanvas = ref<HTMLCanvasElement | null>(null)
const selectedLogId = ref<number | null>(null)
const addError = ref('')

const currentPlayback = computed(() => {
  if (selectedLogId.value) {
    return store.telegraphLogs.find(l => l.id === selectedLogId.value) || null
  }
  return store.telegraphLogs.length > 0 ? store.telegraphLogs[0] : null
})

const availableKeys = computed(() => {
  const used = new Set(store.shortcuts.map(s => s.key))
  return ['1','2','3','4','5','6','7','8','9','0','Q','W','E','R','T','Y','U','I','O','P']
    .filter(k => !used.has(k))
})

function handleAdd() {
  addError.value = ''
  if (!newKey.value || !newMessage.value.trim()) return
  const ok = store.addShortcut(newKey.value, newLabel.value || newMessage.value, newMessage.value.trim().toUpperCase())
  if (!ok) {
    addError.value = `快捷键 Alt+${newKey.value} 已被占用，请选择其他键位`
    return
  }
  newLabel.value = ''
  newMessage.value = ''
  if (availableKeys.value.length > 0) {
    newKey.value = availableKeys.value[0]
  } else {
    newKey.value = ''
  }
  showAddForm.value = false
}

function selectLog(log: TelegraphLog) {
  selectedLogId.value = log.id
}

function replayLog(log: TelegraphLog) {
  store.sendShortcut(log.preset)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const key = e.key.toUpperCase()
    const preset = store.shortcuts.find(s => s.key === key)
    if (preset) {
      e.preventDefault()
      store.sendShortcut(preset)
    }
  }
}

watch(availableKeys, (keys) => {
  if (newKey.value && !keys.includes(newKey.value)) {
    newKey.value = keys.length > 0 ? keys[0] : ''
  }
})

watch(showAddForm, (open) => {
  if (open) {
    addError.value = ''
    if (!availableKeys.value.includes(newKey.value)) {
      newKey.value = availableKeys.value.length > 0 ? availableKeys.value[0] : ''
    }
  }
}, { immediate: true })

let animId = 0

function drawRhythm() {
  const canvas = rhythmCanvas.value
  if (!canvas) { animId = requestAnimationFrame(drawRhythm); return }
  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  const w = rect.width
  const h = rect.height

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()

  const log = currentPlayback.value
  if (!log || log.segments.length === 0) {
    ctx.fillStyle = '#555'
    ctx.font = '14px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('等待发送...', w / 2, h / 2 + 5)
    animId = requestAnimationFrame(drawRhythm)
    return
  }

  const segments = log.segments
  const totalDuration = segments[segments.length - 1].startTime + segments[segments.length - 1].duration
  const padding = 20
  const drawWidth = w - padding * 2
  const scale = drawWidth / totalDuration

  const progress = (log.id === store.telegraphLogs[0]?.id && store.isTelegraphPlaying)
    ? store.playbackProgress
    : 1

  for (const seg of segments) {
    const x = padding + seg.startTime * scale
    const segW = seg.duration * scale

    if (seg.type === 'dot' || seg.type === 'dash') {
      const isOn = (x - padding) / drawWidth <= progress
      if (isOn) {
        const gradient = ctx.createLinearGradient(x, h * 0.2, x, h * 0.8)
        gradient.addColorStop(0, seg.type === 'dot' ? '#fbbf24' : '#f59e0b')
        gradient.addColorStop(1, seg.type === 'dot' ? '#d97706' : '#b45309')
        ctx.fillStyle = gradient
        ctx.beginPath()
        const barH = h * 0.5
        const barY = (h - barH) / 2
        ctx.roundRect(x, barY, Math.max(segW - 1, 2), barH, 2)
        ctx.fill()

        ctx.shadowColor = '#fbbf24'
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      } else {
        ctx.fillStyle = '#333'
        ctx.beginPath()
        const barH = h * 0.5
        const barY = (h - barH) / 2
        ctx.roundRect(x, barY, Math.max(segW - 1, 2), barH, 2)
        ctx.fill()
      }
    }
  }

  if (progress < 1 && store.isTelegraphPlaying) {
    const cursorX = padding + progress * drawWidth
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cursorX, 0)
    ctx.lineTo(cursorX, h)
    ctx.stroke()
  }

  animId = requestAnimationFrame(drawRhythm)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  nextTick(() => { animId = requestAnimationFrame(drawRhythm) })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  cancelAnimationFrame(animId)
})
</script>
