// DS Utils Plugin - Map Palette to Theme Feature
// Maps palette variables to semantic theme variables via aliases

import {
  sendCollectionsToUi,
  sendGroupsForCollectionToUi,
  sendModesForCollectionToUi,
} from '../utils'

interface MapPalettePrefs {
  paletteCollection?: string
  themeCollection?: string
  themeGroup?: string
  platform?: string
  includePlatform?: boolean
  sourcePalette?: string
  semanticPalette?: string
  modeIds?: string[]
}

const PREFS_KEY = 'map-palette-prefs'

export function runMapPalettePlugin() {
  if (figma.editorType === 'figma') {
    figma.showUI(__html__, {
      width: 480,
      height: 560,
      title: 'DS Utils - Map Palette',
      themeColors: true,
    })
  }

  figma.ui.postMessage({ type: 'switch-feature', feature: 'map-palette' })

  figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
      case 'request-collections':
        await sendCollectionsToUi()
        await sendSavedPrefs()
        return
      case 'get-theme-groups':
        await sendGroupsForCollectionToUi(msg.collectionName)
        return
      case 'get-theme-modes':
        await sendModesForCollectionToUi(msg.collectionName)
        return
      case 'get-platforms':
        await sendPlatformsForCollection(msg.collectionName)
        return
      case 'get-palettes':
        await sendPalettesForCollection(msg.collectionName, msg.platform)
        return
      case 'save-preferences':
        await savePrefs(msg)
        return
      case 'apply-mapping':
        await handleApplyMapping(msg)
        return
    }
  }

  sendCollectionsToUi()
  sendSavedPrefs()
}

async function sendSavedPrefs() {
  const prefs = (await figma.clientStorage.getAsync(PREFS_KEY)) || {}
  figma.ui.postMessage({ type: 'saved-preferences', prefs })
}

async function savePrefs(msg: MapPalettePrefs) {
  const next = {
    paletteCollection: msg.paletteCollection || '',
    themeCollection: msg.themeCollection || '',
    themeGroup: msg.themeGroup || '',
      platform: msg.platform || '',
      includePlatform: msg.includePlatform !== false,
      sourcePalette: msg.sourcePalette || '',
      semanticPalette: msg.semanticPalette || '',
    modeIds: Array.isArray(msg.modeIds) ? msg.modeIds : [],
  }
  await figma.clientStorage.setAsync(PREFS_KEY, next)
}

async function sendPlatformsForCollection(collectionName: string) {
  const collection = await getCollectionByName(collectionName)
  if (!collection) {
    figma.ui.postMessage({ type: 'platforms', platforms: [] })
    return
  }
  const platforms = new Set<string>()
  for (const variableId of collection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId)
    if (!variable) continue
    const segments = variable.name.split('/').filter(Boolean)
    if (segments.length === 0) continue
    platforms.add(segments[0])
  }
  figma.ui.postMessage({ type: 'platforms', platforms: Array.from(platforms).sort() })
}

async function sendPalettesForCollection(collectionName: string, platform: string) {
  const collection = await getCollectionByName(collectionName)
  if (!collection) {
    figma.ui.postMessage({ type: 'palettes', palettes: [] })
    return
  }
  const palettes = new Set<string>()
  for (const variableId of collection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId)
    if (!variable) continue
    const match = parsePaletteVariable(variable.name, platform)
    if (!match) continue
    palettes.add(match.palette)
  }
  figma.ui.postMessage({ type: 'palettes', palettes: Array.from(palettes).sort() })
}

async function handleApplyMapping(msg: {
  paletteCollection: string
  themeCollection: string
  themeGroup?: string
  platform?: string
  includePlatform?: boolean
  sourcePalette: string
  semanticPalette: string
  modeIds?: string[]
}) {
  const {
    paletteCollection,
    themeCollection,
    themeGroup,
    platform,
    includePlatform,
    sourcePalette,
    semanticPalette,
    modeIds,
  } = msg

  if (!paletteCollection || !themeCollection) {
    figma.notify('Select both palette and theme collections.')
    return
  }
  if (!sourcePalette || !semanticPalette) {
    figma.notify('Enter source and semantic palette names.')
    return
  }

  const paletteCol = await getCollectionByName(paletteCollection)
  const themeCol = await getCollectionByName(themeCollection)
  if (!paletteCol || !themeCol) {
    figma.notify('Collection not found.')
    return
  }

  const themeModeIds = new Set(themeCol.modes.map((m) => m.modeId))
  const requestedModes = Array.isArray(modeIds) ? modeIds.filter((id) => themeModeIds.has(id)) : []
  const selectedModes = requestedModes.length > 0 ? requestedModes : themeCol.modes.map((m) => m.modeId)

  const sourceByShade = new Map<string, Variable>()
  for (const variableId of paletteCol.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId)
    if (!variable || variable.resolvedType !== 'COLOR') continue
    const parsed = parsePaletteVariable(variable.name, platform || '')
    if (!parsed) continue
    if (parsed.palette !== sourcePalette) continue
    sourceByShade.set(parsed.shade, variable)
  }

  if (sourceByShade.size === 0) {
    figma.ui.postMessage({
      type: 'map-result',
      result: {
        created: 0,
        updated: 0,
        skipped: 0,
        missing: 0,
        shades: 0,
      },
    })
    figma.notify('No matching palette variables found.')
    return
  }

  const themeByName = new Map<string, Variable>()
  for (const variableId of themeCol.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId)
    if (v) themeByName.set(v.name, v)
  }

  let created = 0
  let updated = 0
  let skipped = 0
  let missing = 0

  const targetParts = computeTargetParts(platform || '', semanticPalette, includePlatform !== false)
  for (const [shade, sourceVar] of sourceByShade.entries()) {
    const targetName = buildTargetName(themeGroup || '', targetParts.platform, targetParts.semantic, shade)
    const existing = themeByName.get(targetName)
    if (existing) {
      if (existing.resolvedType !== 'COLOR') {
        skipped += 1
        continue
      }
      for (const modeId of selectedModes) {
        existing.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: sourceVar.id })
      }
      updated += 1
    } else {
      try {
        const createdVar = figma.variables.createVariable(targetName, themeCol, 'COLOR')
        for (const modeId of selectedModes) {
          createdVar.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: sourceVar.id })
        }
        themeByName.set(targetName, createdVar)
        created += 1
      } catch (error) {
        missing += 1
      }
    }
  }

  figma.ui.postMessage({
    type: 'map-result',
    result: {
      created,
      updated,
      skipped,
      missing,
      shades: sourceByShade.size,
    },
  })
}

function buildTargetName(group: string, platform: string, semantic: string, shade: string) {
  const segments = [group, platform, semantic, shade].filter(Boolean)
  return segments.join('/')
}

function computeTargetParts(platform: string, semantic: string, includePlatform: boolean) {
  if (platform.endsWith('-alpha')) {
    const basePlatform = platform.slice(0, -6)
    return {
      platform: includePlatform ? basePlatform : '',
      semantic: semantic ? `${semantic}-alpha` : 'alpha',
    }
  }
  return { platform: includePlatform ? platform : '', semantic }
}

function parsePaletteVariable(name: string, platform: string) {
  const segments = name.split('/').filter(Boolean)
  if (segments.length === 0) return null
  let remainder = ''
  if (platform) {
    if (segments[0] !== platform) return null
    remainder = segments.slice(1).join('/')
  } else {
    remainder = segments.join('/')
  }
  if (!remainder) return null

  if (remainder.includes('/')) {
    const parts = remainder.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return { palette: parts[0], shade: parts[parts.length - 1] }
  }

  const lastDash = remainder.lastIndexOf('-')
  if (lastDash <= 0 || lastDash === remainder.length - 1) return null
  return { palette: remainder.slice(0, lastDash), shade: remainder.slice(lastDash + 1) }
}

async function getCollectionByName(name: string) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  return collections.find((c) => c.name === name) || null
}
