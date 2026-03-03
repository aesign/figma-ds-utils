import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@ui/components/ui/Button'
import { Input } from '@ui/components/ui/Input'
import { cn } from '@ui/lib/utils'

interface Mode {
  id: string
  name: string
}

interface MapPrefs {
  paletteCollection?: string
  themeCollection?: string
  themeGroup?: string
  platform?: string
  includePlatform?: boolean
  sourcePalette?: string
  semanticPalette?: string
  modeIds?: string[]
}

interface MapResult {
  created: number
  updated: number
  skipped: number
  missing: number
  shades: number
}

export function MapPalette() {
  const [collections, setCollections] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])
  const [palettes, setPalettes] = useState<string[]>([])
  const [themeGroups, setThemeGroups] = useState<string[]>([])
  const [themeModes, setThemeModes] = useState<Mode[]>([])

  const [paletteCollection, setPaletteCollection] = useState('')
  const [themeCollection, setThemeCollection] = useState('')
  const [themeGroup, setThemeGroup] = useState('')
  const [platform, setPlatform] = useState('')
  const [includePlatform, setIncludePlatform] = useState(true)
  const [sourcePalette, setSourcePalette] = useState('')
  const [semanticPalette, setSemanticPalette] = useState('')
  const [modeIds, setModeIds] = useState<string[]>([])

  const [result, setResult] = useState<MapResult | null>(null)

  const prefsRef = useRef<MapPrefs>({})

  const selectClassName = cn(
    'flex h-9 w-full rounded-md border px-3 py-1',
    'text-sm transition-colors focus-visible:outline-none focus-visible:ring-1',
    'bg-[var(--figma-color-bg)]',
    'border-[var(--figma-color-border)]',
    'text-[var(--figma-color-text)]',
    'focus-visible:border-[var(--figma-color-border-brand-strong)]',
    'focus-visible:ring-[var(--figma-color-border-brand-strong)]'
  )

  const savePrefs = (next: MapPrefs) => {
    prefsRef.current = next
    parent.postMessage({ pluginMessage: { type: 'save-preferences', ...next } }, '*')
  }

  const handleApply = () => {
    if (!paletteCollection || !themeCollection || !sourcePalette || !semanticPalette) return
    setResult(null)
    parent.postMessage({
      pluginMessage: {
        type: 'apply-mapping',
        paletteCollection,
        themeCollection,
        themeGroup: themeGroup || '',
        platform: platform || '',
        includePlatform,
        sourcePalette: sourcePalette.trim(),
        semanticPalette: semanticPalette.trim(),
        modeIds,
      },
    }, '*')
    savePrefs({
      paletteCollection,
      themeCollection,
      themeGroup,
      platform,
      includePlatform,
      sourcePalette,
      semanticPalette,
      modeIds,
    })
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data ? event.data.pluginMessage : undefined
      if (!msg) return

      switch (msg.type) {
        case 'collections': {
          const list = msg.collections || []
          setCollections(list)
          const prefs = prefsRef.current
          if (prefs.paletteCollection && list.includes(prefs.paletteCollection)) {
            setPaletteCollection(prefs.paletteCollection)
          } else if (!paletteCollection && list.length > 0) {
            setPaletteCollection(list[0])
          }
          if (prefs.themeCollection && list.includes(prefs.themeCollection)) {
            setThemeCollection(prefs.themeCollection)
          } else if (!themeCollection && list.length > 0) {
            setThemeCollection(list[0])
          }
          break
        }
        case 'platforms': {
          const list = msg.platforms || []
          setPlatforms(list)
          const prefs = prefsRef.current
          if (prefs.platform && list.includes(prefs.platform)) {
            setPlatform(prefs.platform)
          } else if (!platform && list.length > 0) {
            setPlatform(list[0])
          } else if (platform && !list.includes(platform)) {
            setPlatform(list[0] || '')
          }
          break
        }
        case 'palettes':
          setPalettes(msg.palettes || [])
          break
        case 'groups':
          setThemeGroups(msg.groups || [])
          break
        case 'modes': {
          const list = msg.modes || []
          setThemeModes(list)
          const prefs = prefsRef.current
          const isNew = !prefs.themeCollection || prefs.themeCollection !== themeCollection
          const preferred = Array.isArray(prefs.modeIds) ? prefs.modeIds : []
          const nextModeIds = isNew || preferred.length === 0
            ? list.map((mode: Mode) => mode.id)
            : preferred.filter((id) => list.some((mode: Mode) => mode.id === id))
          setModeIds(nextModeIds)
          break
        }
        case 'saved-preferences': {
          const prefs = (msg.prefs || {}) as MapPrefs
          prefsRef.current = prefs
          if (prefs.paletteCollection) setPaletteCollection(prefs.paletteCollection)
          if (prefs.themeCollection) setThemeCollection(prefs.themeCollection)
          if (prefs.themeGroup) setThemeGroup(prefs.themeGroup)
          if (prefs.platform) setPlatform(prefs.platform)
          if (prefs.includePlatform !== undefined) setIncludePlatform(prefs.includePlatform)
          if (prefs.sourcePalette) setSourcePalette(prefs.sourcePalette)
          if (prefs.semanticPalette) setSemanticPalette(prefs.semanticPalette)
          if (Array.isArray(prefs.modeIds)) setModeIds(prefs.modeIds)
          break
        }
        case 'map-result':
          setResult(msg.result as MapResult)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [paletteCollection, themeCollection])

  useEffect(() => {
    if (!paletteCollection) return
    parent.postMessage({ pluginMessage: { type: 'get-platforms', collectionName: paletteCollection } }, '*')
  }, [paletteCollection])

  useEffect(() => {
    if (!paletteCollection) return
    parent.postMessage({ pluginMessage: { type: 'get-palettes', collectionName: paletteCollection, platform } }, '*')
  }, [paletteCollection, platform])

  useEffect(() => {
    if (!themeCollection) return
    parent.postMessage({ pluginMessage: { type: 'get-theme-groups', collectionName: themeCollection } }, '*')
    parent.postMessage({ pluginMessage: { type: 'get-theme-modes', collectionName: themeCollection } }, '*')
  }, [themeCollection])

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*')
  }, [])

  const handlePlatformChange = (value: string) => {
    setPlatform(value)
    savePrefs({ ...prefsRef.current, platform: value })
  }

  const handleThemeGroupChange = (value: string) => {
    setThemeGroup(value)
    savePrefs({ ...prefsRef.current, themeGroup: value })
  }

  const handleIncludePlatformChange = (value: boolean) => {
    setIncludePlatform(value)
    savePrefs({ ...prefsRef.current, includePlatform: value })
  }

  const handleModeToggle = (id: string, checked: boolean) => {
    const next = checked ? [...modeIds, id] : modeIds.filter((modeId) => modeId !== id)
    setModeIds(next)
    savePrefs({ ...prefsRef.current, modeIds: next })
  }

  const isApplyDisabled = useMemo(() => {
    return !paletteCollection || !themeCollection || !platform || !sourcePalette.trim() || !semanticPalette.trim()
  }, [paletteCollection, themeCollection, platform, sourcePalette, semanticPalette])

  const previewTarget = useMemo(() => {
    const basePlatform = platform.endsWith('-alpha') ? platform.slice(0, -6) : platform
    const targetPlatform = includePlatform ? basePlatform : ''
    const targetSemantic = platform.endsWith('-alpha') && semanticPalette
      ? `${semanticPalette}-alpha`
      : semanticPalette
    const segments = [themeGroup, targetPlatform, targetSemantic, '50'].filter(Boolean)
    if (segments.length === 0) return '[group]/[platform]/[semantic]/[shade]'
    return segments.join('/')
  }, [themeGroup, platform, semanticPalette, includePlatform])

  return (
    <div className="p-3" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
    }}>
      <h2 className="text-sm font-medium text-[var(--figma-color-text)] mb-3">
        Map Palette
      </h2>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2 mb-3'
      )}>
        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Palette collection
          </label>
          <select
            className={selectClassName}
            value={paletteCollection}
            onChange={(e) => setPaletteCollection(e.target.value)}
          >
            {collections.map((collection) => (
              <option key={collection} value={collection}>{collection}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Theme collection
          </label>
          <select
            className={selectClassName}
            value={themeCollection}
            onChange={(e) => setThemeCollection(e.target.value)}
          >
            {collections.map((collection) => (
              <option key={collection} value={collection}>{collection}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2 mb-3'
      )}>
        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Group
          </label>
          <select
            className={selectClassName}
            value={platform}
            onChange={(e) => handlePlatformChange(e.target.value)}
          >
            {platforms.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Source palette
          </label>
          <div className="space-y-1">
            <Input
              value={sourcePalette}
              onChange={(e) => setSourcePalette(e.target.value)}
              placeholder="e.g. red"
              className="text-xs h-8"
              list="palette-options"
            />
            <datalist id="palette-options">
              {palettes.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Include group in target
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--figma-color-text)]">
            <input
              type="checkbox"
              checked={includePlatform}
              onChange={(e) => handleIncludePlatformChange(e.target.checked)}
            />
            <span>{includePlatform ? 'Included' : 'Omit group segment'}</span>
          </label>
        </div>
      </div>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2'
      )}>
        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Theme group (optional)
          </label>
          <select
            className={selectClassName}
            value={themeGroup}
            onChange={(e) => handleThemeGroupChange(e.target.value)}
          >
            <option value="">No group</option>
            {themeGroups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Semantic palette
          </label>
          <Input
            value={semanticPalette}
            onChange={(e) => setSemanticPalette(e.target.value)}
            placeholder="e.g. danger"
            className="text-xs h-8"
          />
        </div>

        {themeModes.length > 1 && (
          <div className="space-y-1">
            <div className="text-xs text-[var(--figma-color-text-secondary)]">
              Modes (checked = included):
            </div>
            <div className={cn(
              'max-h-[120px] overflow-auto rounded-md p-2 space-y-1',
              'bg-[var(--figma-color-bg-secondary)]',
              'border border-[var(--figma-color-border)]'
            )}>
              {themeModes.map((mode) => {
                const checked = modeIds.includes(mode.id)
                return (
                  <label key={mode.id} className="flex items-center gap-2 text-xs text-[var(--figma-color-text)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleModeToggle(mode.id, e.target.checked)}
                    />
                    <span>{mode.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-[var(--figma-color-text-secondary)]">
          Target naming preview: {previewTarget}
        </div>
        <div className="text-xs text-[var(--figma-color-text-secondary)]">
          Existing theme variables will be updated (aliases). Missing ones will be created.
        </div>

        {result && (
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Shades {result.shades} • Created {result.created} • Updated {result.updated} • Skipped {result.skipped} • Failed {result.missing}
          </div>
        )}

        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Maps {platform || '[group]'}/{sourcePalette || '[palette]'}/[shade] → {previewTarget}
          </div>
          <Button
            onClick={handleApply}
            disabled={isApplyDisabled}
            size="sm"
            className="text-xs font-semibold"
            variant="primary"
          >
            Map Palette
          </Button>
        </div>
      </div>
    </div>
  )
}
