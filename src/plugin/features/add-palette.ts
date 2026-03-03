// DS Utils Plugin - Add Palette Feature
// Creates or updates color variables from CSS custom properties in OKLCH

import {
  sendCollectionsToUi,
  sendGroupsForCollectionToUi,
  sendModesForCollectionToUi,
} from '../utils'

interface ParsedColor {
  name: string
  shade: string
  rgb: RGB | RGBA
}

interface PalettePrefs {
  collectionName?: string
  groupName?: string
  modeIds?: string[]
}

const PREFS_KEY = 'palette-prefs'

export function runAddPalettePlugin() {
  if (figma.editorType === 'figma') {
    figma.showUI(__html__, {
      width: 460,
      height: 520,
      title: 'DS Utils - Add Palette',
      themeColors: true,
    })
  }

  figma.ui.postMessage({ type: 'switch-feature', feature: 'add-palette' })

  figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
      case 'request-collections':
        await sendCollectionsToUi()
        await sendSavedPalettePrefs()
        return
      case 'get-groups':
        await sendGroupsForCollectionToUi(msg.collectionName)
        return
      case 'get-modes':
        await sendModesForCollectionToUi(msg.collectionName)
        return
      case 'save-preferences':
        await savePalettePrefs(msg)
        return
      case 'add-palette':
        await handleAddPalette(msg)
        return
    }
  }

  sendCollectionsToUi()
  sendSavedPalettePrefs()
}

async function sendSavedPalettePrefs() {
  const prefs = (await figma.clientStorage.getAsync(PREFS_KEY)) || {}
  figma.ui.postMessage({ type: 'saved-preferences', prefs })
}

async function savePalettePrefs(msg: PalettePrefs) {
  const next = {
    collectionName: msg.collectionName || '',
    groupName: msg.groupName || '',
    modeIds: Array.isArray(msg.modeIds) ? msg.modeIds : [],
  }
  await figma.clientStorage.setAsync(PREFS_KEY, next)
}

async function handleAddPalette(msg: {
  collectionName: string
  groupName?: string
  modeIds?: string[]
  inputText: string
}) {
  const { collectionName, groupName, modeIds, inputText } = msg

  if (!collectionName) {
    figma.notify('Select a collection first.')
    return
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const collection = collections.find((c) => c.name === collectionName)
  if (!collection) {
    figma.notify(`Collection not found: ${collectionName}`)
    return
  }

  const collectionModeIds = new Set(collection.modes.map((m) => m.modeId))
  const requestedModes = Array.isArray(modeIds)
    ? modeIds.filter((id) => collectionModeIds.has(id))
    : []
  const selectedModes = requestedModes.length > 0
    ? requestedModes
    : collection.modes.map((m) => m.modeId)

  const parsed = parsePaletteInput(inputText)
  if (parsed.items.length === 0) {
    figma.ui.postMessage({
      type: 'add-palette-result',
      result: {
        created: 0,
        updated: 0,
        skipped: parsed.skipped,
        errors: parsed.errors,
      },
    })
    figma.notify('No valid color entries found.')
    return
  }

  const byName = new Map<string, Variable>()
  for (const variableId of collection.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId)
    if (v) byName.set(v.name, v)
  }

  let created = 0
  let updated = 0
  let skipped = parsed.skipped

  const prefix = groupName ? `${groupName}/` : ''

  for (const item of parsed.items) {
    const variableName = `${prefix}${item.name}/${item.shade}`
    const existing = byName.get(variableName)
    if (existing) {
      if (existing.resolvedType !== 'COLOR') {
        skipped += 1
        continue
      }
      for (const modeId of selectedModes) {
        existing.setValueForMode(modeId, item.rgb)
      }
      updated += 1
      continue
    }

    try {
      const createdVar = figma.variables.createVariable(variableName, collection, 'COLOR')
      for (const modeId of selectedModes) {
        createdVar.setValueForMode(modeId, item.rgb)
      }
      byName.set(variableName, createdVar)
      created += 1
    } catch (error) {
      skipped += 1
    }
  }

  figma.ui.postMessage({
    type: 'add-palette-result',
    result: {
      created,
      updated,
      skipped,
      errors: parsed.errors,
    },
  })
}

function parsePaletteInput(input: string): {
  items: ParsedColor[]
  skipped: number
  errors: string[]
} {
  const items: ParsedColor[] = []
  const errors: string[] = []
  let skipped = 0

  const lines = (input || '').split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (!line.includes('--color-')) continue

    const match = line.match(/--color-([^:]+):\s*([^;]+)\s*;?/i)
    if (!match) {
      skipped += 1
      continue
    }

    const token = match[1].trim()
    const lastDash = token.lastIndexOf('-')
    if (lastDash <= 0 || lastDash === token.length - 1) {
      skipped += 1
      continue
    }

    const colorName = token.slice(0, lastDash)
    const shade = token.slice(lastDash + 1)

    const colorValue = match[2].trim()
    const rgb = parseColorToRgb(colorValue)
    if (!rgb) {
      errors.push(`Invalid color value: ${colorValue}`)
      skipped += 1
      continue
    }
    items.push({ name: colorName, shade, rgb })
  }

  return { items, skipped, errors }
}

function parseOklch(value: string): { l: number; c: number; h: number; a?: number } | null {
  const normalized = value.trim()
  const split = normalized.split('/')
  const main = split[0].trim().replace(/\s+/g, ' ')
  const parts = main.split(' ')
  if (parts.length < 3) return null
  const lRaw = parts[0].endsWith('%') ? parts[0].slice(0, -1) : parts[0]
  const l = Number(lRaw)
  const c = Number(parts[1])
  const h = Number(parts[2])
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return null
  let a: number | undefined
  if (split.length > 1) {
    const alphaRaw = split[1].trim()
    const parsed = parseAlpha(alphaRaw)
    if (parsed == null) return null
    a = parsed
  }
  return { l: l / 100, c, h, a }
}

function parseColorToRgb(value: string): RGB | RGBA | null {
  const v = value.trim()
  if (v.startsWith('#')) {
    return parseHexToRgb(v)
  }
  if (v.toLowerCase().startsWith('oklch(')) {
    const inner = v.slice(6, -1)
    const oklch = parseOklch(inner)
    if (!oklch) return null
    return oklchToSrgb(oklch.l, oklch.c, oklch.h, oklch.a)
  }
  if (v.toLowerCase().startsWith('rgb(') || v.toLowerCase().startsWith('rgba(')) {
    return parseRgbFunction(v)
  }
  if (v.toLowerCase().startsWith('hsl(') || v.toLowerCase().startsWith('hsla(')) {
    return parseHslFunction(v)
  }
  return null
}

function parseHexToRgb(value: string): RGB | RGBA | null {
  const hex = value.replace('#', '').trim()
  if (![3, 4, 6, 8].includes(hex.length)) return null
  const expand = (ch: string) => ch + ch
  const toByte = (str: string) => parseInt(str, 16)
  let r = 0
  let g = 0
  let b = 0
  let a: number | null = null
  if (hex.length === 3 || hex.length === 4) {
    r = toByte(expand(hex[0]))
    g = toByte(expand(hex[1]))
    b = toByte(expand(hex[2]))
    if (hex.length === 4) {
      a = toByte(expand(hex[3]))
    }
  } else {
    r = toByte(hex.slice(0, 2))
    g = toByte(hex.slice(2, 4))
    b = toByte(hex.slice(4, 6))
    if (hex.length === 8) {
      a = toByte(hex.slice(6, 8))
    }
  }
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  if (a == null || Number.isNaN(a)) {
    return { r: r / 255, g: g / 255, b: b / 255 }
  }
  return { r: r / 255, g: g / 255, b: b / 255, a: clamp01(a / 255) }
}

function parseRgbFunction(value: string): RGB | RGBA | null {
  const inner = value.substring(value.indexOf('(') + 1, value.lastIndexOf(')'))
  const parts = inner.split(',').map((p) => p.trim())
  if (parts.length < 3) return null
  const r = parseRgbChannel(parts[0])
  const g = parseRgbChannel(parts[1])
  const b = parseRgbChannel(parts[2])
  if (r == null || g == null || b == null) return null
  if (parts.length >= 4) {
    const a = parseAlpha(parts[3])
    if (a == null) return null
    return { r, g, b, a }
  }
  return { r, g, b }
}

function parseRgbChannel(value: string): number | null {
  if (value.endsWith('%')) {
    const num = Number(value.slice(0, -1))
    if (!Number.isFinite(num)) return null
    return clamp01(num / 100)
  }
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return clamp01(num / 255)
}

function parseHslFunction(value: string): RGB | RGBA | null {
  const inner = value.substring(value.indexOf('(') + 1, value.lastIndexOf(')'))
  const parts = inner.split(',').map((p) => p.trim())
  if (parts.length < 3) return null
  const h = Number(parts[0].replace('deg', '').trim())
  const s = parsePercent(parts[1])
  const l = parsePercent(parts[2])
  if (!Number.isFinite(h) || s == null || l == null) return null
  const rgb = hslToRgb(h, s, l)
  if (parts.length >= 4) {
    const a = parseAlpha(parts[3])
    if (a == null) return null
    return { ...rgb, a }
  }
  return rgb
}

function parsePercent(value: string): number | null {
  if (!value.endsWith('%')) return null
  const num = Number(value.slice(0, -1))
  if (!Number.isFinite(num)) return null
  return clamp01(num / 100)
}

function parseAlpha(value: string): number | null {
  const v = value.trim()
  if (v.endsWith('%')) {
    const num = Number(v.slice(0, -1))
    if (!Number.isFinite(num)) return null
    return clamp01(num / 100)
  }
  const num = Number(v)
  if (!Number.isFinite(num)) return null
  return clamp01(num)
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hp >= 0 && hp < 1) {
    r1 = c; g1 = x; b1 = 0
  } else if (hp >= 1 && hp < 2) {
    r1 = x; g1 = c; b1 = 0
  } else if (hp >= 2 && hp < 3) {
    r1 = 0; g1 = c; b1 = x
  } else if (hp >= 3 && hp < 4) {
    r1 = 0; g1 = x; b1 = c
  } else if (hp >= 4 && hp < 5) {
    r1 = x; g1 = 0; b1 = c
  } else {
    r1 = c; g1 = 0; b1 = x
  }
  const m = l - c / 2
  return { r: clamp01(r1 + m), g: clamp01(g1 + m), b: clamp01(b1 + m) }
}

function oklchToSrgb(l: number, c: number, h: number, alpha?: number): RGB | RGBA {
  const hr = (h * Math.PI) / 180
  const a = Math.cos(hr) * c
  const b = Math.sin(hr) * c
  const rgb = oklabToSrgb(l, a, b)
  if (alpha == null) return rgb
  return { ...rgb, a: clamp01(alpha) }
}

function oklabToSrgb(l: number, a: number, b: number): RGB {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  let b2 = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  r = clamp01(linearToSrgb(r))
  g = clamp01(linearToSrgb(g))
  b2 = clamp01(linearToSrgb(b2))

  return { r, g, b: b2 }
}

function linearToSrgb(value: number) {
  if (value <= 0.0031308) return 12.92 * value
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
