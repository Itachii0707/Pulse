import { app, screen, type BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

const DEFAULT_STATE: WindowState = {
  width: 1100,
  height: 800,
  isMaximized: false
}

const MIN_WIDTH = 720
const MIN_HEIGHT = 620

function stateFilePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

export function loadWindowState(): WindowState {
  try {
    const file = stateFilePath()
    if (!existsSync(file)) return { ...DEFAULT_STATE }
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as Partial<WindowState>

    const width =
      typeof raw.width === 'number' && Number.isFinite(raw.width)
        ? Math.max(MIN_WIDTH, raw.width)
        : DEFAULT_STATE.width

    const height =
      typeof raw.height === 'number' && Number.isFinite(raw.height)
        ? Math.max(MIN_HEIGHT, raw.height)
        : DEFAULT_STATE.height

    const isMaximized = Boolean(raw.isMaximized)
    let x = typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : undefined
    let y = typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : undefined

    // Validate that coordinates are on an existing connected display
    if (x !== undefined && y !== undefined) {
      const displays = screen.getAllDisplays()
      const onScreen = displays.some((display) => {
        const { x: dx, y: dy, width: dw, height: dh } = display.workArea
        return x! >= dx - 20 && x! <= dx + dw - 50 && y! >= dy - 20 && y! <= dy + dh - 50
      })
      if (!onScreen) {
        x = undefined
        y = undefined
      }
    }

    return { x, y, width, height, isMaximized }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function trackWindowState(window: BrowserWindow): () => void {
  const state = loadWindowState()
  let saveTimer: NodeJS.Timeout | null = null

  const save = (): void => {
    try {
      if (!window.isDestroyed()) {
        const isMaximized = window.isMaximized()
        state.isMaximized = isMaximized
        if (!isMaximized) {
          const bounds = window.getBounds()
          state.x = bounds.x
          state.y = bounds.y
          state.width = bounds.width
          state.height = bounds.height
        }
      }
      writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), 'utf-8')
    } catch {
      // Ignore write failures on exit
    }
  }

  const debouncedSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(save, 500)
  }

  window.on('resize', debouncedSave)
  window.on('move', debouncedSave)
  window.on('maximize', () => {
    state.isMaximized = true
    debouncedSave()
  })
  window.on('unmaximize', () => {
    state.isMaximized = false
    debouncedSave()
  })
  window.on('close', save)

  return () => {
    if (saveTimer) clearTimeout(saveTimer)
    save()
  }
}
