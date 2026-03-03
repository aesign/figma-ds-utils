import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@ui/components/ui/Button'
import { Input } from '@ui/components/ui/Input'
import { cn } from '@ui/lib/utils'

interface Mode {
  id: string
  name: string
}

interface SavedPrefs {
  collectionName?: string
  groupName?: string
  modeIds?: string[]
}

interface AddPaletteResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export function AddPalette() {
  const [collections, setCollections] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [modes, setModes] = useState<Mode[]>([])

  const [collectionName, setCollectionName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [modeIds, setModeIds] = useState<string[]>([])

  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<AddPaletteResult | null>(null)

  const savedPrefsRef = useRef<SavedPrefs>({})

  const selectClassName = cn(
    'flex h-9 w-full rounded-md border px-3 py-1',
    'text-sm transition-colors focus-visible:outline-none focus-visible:ring-1',
    'bg-[var(--figma-color-bg)]',
    'border-[var(--figma-color-border)]',
    'text-[var(--figma-color-text)]',
    'focus-visible:border-[var(--figma-color-border-brand-strong)]',
    'focus-visible:ring-[var(--figma-color-border-brand-strong)]'
  )

  const savePrefs = (next: SavedPrefs) => {
    savedPrefsRef.current = next
    parent.postMessage({ pluginMessage: { type: 'save-preferences', ...next } }, '*')
  }

  const handleApply = () => {
    if (!collectionName || !inputText.trim()) return
    setResult(null)
    parent.postMessage({
      pluginMessage: {
        type: 'add-palette',
        collectionName,
        groupName: groupName || '',
        modeIds,
        inputText,
      },
    }, '*')
    savePrefs({ collectionName, groupName, modeIds })
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data ? event.data.pluginMessage : undefined
      if (!msg) return

      switch (msg.type) {
        case 'collections': {
          const list = msg.collections || []
          setCollections(list)
          const prefs = savedPrefsRef.current
          if (prefs.collectionName && list.includes(prefs.collectionName)) {
            setCollectionName(prefs.collectionName)
          } else if (!collectionName && list.length > 0) {
            setCollectionName(list[0])
          }
          break
        }
        case 'groups': {
          const list = msg.groups || []
          setGroups(list)
          const prefs = savedPrefsRef.current
          if (prefs.groupName && list.includes(prefs.groupName)) {
            setGroupName(prefs.groupName)
          }
          break
        }
        case 'modes': {
          const list = msg.modes || []
          setModes(list)
          const prefs = savedPrefsRef.current
          const isNewCollection = !prefs.collectionName || prefs.collectionName !== collectionName
          const preferred = Array.isArray(prefs.modeIds) ? prefs.modeIds : []
          const nextModeIds = isNewCollection || preferred.length === 0
            ? list.map((mode: Mode) => mode.id)
            : preferred.filter((id) => list.some((mode: Mode) => mode.id === id))
          setModeIds(nextModeIds)
          break
        }
        case 'saved-preferences': {
          const prefs = (msg.prefs || {}) as SavedPrefs
          savedPrefsRef.current = prefs
          if (prefs.collectionName) setCollectionName(prefs.collectionName)
          if (prefs.groupName) setGroupName(prefs.groupName)
          if (Array.isArray(prefs.modeIds)) setModeIds(prefs.modeIds)
          break
        }
        case 'add-palette-result': {
          setResult(msg.result as AddPaletteResult)
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [collectionName])

  useEffect(() => {
    if (!collectionName) return
    parent.postMessage({ pluginMessage: { type: 'get-groups', collectionName } }, '*')
    parent.postMessage({ pluginMessage: { type: 'get-modes', collectionName } }, '*')
  }, [collectionName])

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*')
  }, [])

  const handleGroupChange = (value: string) => {
    setGroupName(value)
    savePrefs({ ...savedPrefsRef.current, collectionName, groupName: value, modeIds })
  }

  const handleModeToggle = (id: string, checked: boolean) => {
    const next = checked ? [...modeIds, id] : modeIds.filter((modeId) => modeId !== id)
    setModeIds(next)
    savePrefs({ ...savedPrefsRef.current, collectionName, groupName, modeIds: next })
  }

  const isApplyDisabled = useMemo(() => {
    return !collectionName || !inputText.trim()
  }, [collectionName, inputText])

  const exampleName = useMemo(() => {
    const lines = inputText.split('\n').map((line) => line.trim()).filter(Boolean)
    for (const line of lines) {
      const match = line.match(/--color-([^:]+):/i)
      if (!match) continue
      const token = match[1].trim()
      const lastDash = token.lastIndexOf('-')
      if (lastDash <= 0 || lastDash === token.length - 1) continue
      return {
        colorName: token.slice(0, lastDash),
        shade: token.slice(lastDash + 1),
      }
    }
    return null
  }, [inputText])

  const inputStats = useMemo(() => {
    const lines = inputText.split('\n').map((line) => line.trim()).filter(Boolean)
    const paletteNames = new Set<string>()
    let parsedLines = 0
    for (const line of lines) {
      const match = line.match(/--color-([^:]+):/i)
      if (!match) continue
      const token = match[1].trim()
      const lastDash = token.lastIndexOf('-')
      if (lastDash <= 0 || lastDash === token.length - 1) continue
      const colorName = token.slice(0, lastDash)
      paletteNames.add(colorName)
      parsedLines += 1
    }
    return { palettes: paletteNames.size, lines: parsedLines }
  }, [inputText])

  return (
    <div className="p-3" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
    }}>
      <h2 className="text-sm font-medium text-[var(--figma-color-text)] mb-3">
        Add Palette
      </h2>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2 mb-3'
      )}>
        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Collection
          </label>
          <select
            className={selectClassName}
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
          >
            {collections.map((collection) => (
              <option key={collection} value={collection}>{collection}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Group (optional)
          </label>
          <select
            className={selectClassName}
            value={groupName}
            onChange={(e) => handleGroupChange(e.target.value)}
          >
            <option value="">No group</option>
            {groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        {modes.length > 1 && (
          <div className="space-y-1">
            <div className="text-xs text-[var(--figma-color-text-secondary)]">
              Modes (checked = included):
            </div>
            <div className={cn(
              'max-h-[120px] overflow-auto rounded-md p-2 space-y-1',
              'bg-[var(--figma-color-bg-secondary)]',
              'border border-[var(--figma-color-border)]'
            )}>
              {modes.map((mode) => {
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
      </div>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2'
      )}>
        <label className="text-xs text-[var(--figma-color-text)]">
          Palette input (OKLCH)
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste CSS custom properties here…"
          className={cn(
            'w-full min-h-[160px] rounded-md border px-3 py-2 text-xs',
            'bg-[var(--figma-color-bg)]',
            'border-[var(--figma-color-border)]',
            'text-[var(--figma-color-text)]',
            'focus-visible:outline-none focus-visible:ring-1',
            'focus-visible:border-[var(--figma-color-border-brand-strong)]',
            'focus-visible:ring-[var(--figma-color-border-brand-strong)]'
          )}
        />
        <div className="text-xs text-[var(--figma-color-text-secondary)]">
          Existing variables will be updated. Missing variables will be created.
        </div>

        {(inputStats.palettes > 0 || inputStats.lines > 0) && (
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            {inputStats.palettes} palette{inputStats.palettes === 1 ? '' : 's'} detected • {inputStats.lines} line{inputStats.lines === 1 ? '' : 's'} parsed
          </div>
        )}

        {result && (
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Created {result.created}, updated {result.updated}, skipped {result.skipped}.
          </div>
        )}

        {result && result.errors && result.errors.length > 0 && (
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            {result.errors.slice(0, 3).map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Names are built as {groupName ? `${groupName}/` : ''}{exampleName ? `${exampleName.colorName}/${exampleName.shade}` : '[colorName]/[shade]'}.
          </div>
          <Button
            onClick={handleApply}
            disabled={isApplyDisabled}
            size="sm"
            className="text-xs font-semibold"
            variant="primary"
          >
            Add Palette
          </Button>
        </div>
      </div>
    </div>
  )
}
