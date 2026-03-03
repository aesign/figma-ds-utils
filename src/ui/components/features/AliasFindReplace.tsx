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

interface PreviewImpact {
  affectedAliasEntries: number
  affectedVariablesCount: number
  oldPrefixVariableCount: number
  newPrefixVariableCount: number
  newPrefixVariableNames?: string[]
  candidateVariablesCount: number
}

export function AliasFindReplace() {
  const [collections, setCollections] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [modes, setModes] = useState<Mode[]>([])

  const [collectionName, setCollectionName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [modeIds, setModeIds] = useState<string[]>([])

  const [savedPrefs, setSavedPrefs] = useState<SavedPrefs>({})
  const savedPrefsRef = useRef<SavedPrefs>({})

  const [variableNameFilter, setVariableNameFilter] = useState('')
  const [oldAliasPrefix, setOldAliasPrefix] = useState('')
  const [newAliasPrefix, setNewAliasPrefix] = useState('')
  const [newLastSegment, setNewLastSegment] = useState('')
  const [matchAnywhere, setMatchAnywhere] = useState(false)

  const [oldError, setOldError] = useState('')
  const [newError, setNewError] = useState('')
  const [lastError, setLastError] = useState('')

  const [varFilterMsg, setVarFilterMsg] = useState('')
  const [oldMsg, setOldMsg] = useState('')
  const [newMsg, setNewMsg] = useState('')

  const previewTimerRef = useRef<number | null>(null)

  useEffect(() => {
    savedPrefsRef.current = savedPrefs
  }, [savedPrefs])

  const selectClassName = cn(
    'flex h-9 w-full rounded-md border px-3 py-1',
    'text-sm transition-colors focus-visible:outline-none focus-visible:ring-1',
    'bg-[var(--figma-color-bg)]',
    'border-[var(--figma-color-border)]',
    'text-[var(--figma-color-text)]',
    'focus-visible:border-[var(--figma-color-border-brand-strong)]',
    'focus-visible:ring-[var(--figma-color-border-brand-strong)]'
  )

  const normalizePrefix = (value: string) => {
    if (!value) return ''
    let next = String(value).trim()
    next = next.replace(/\s+/g, '')
    next = next.replace(/\/+/g, '/')
    next = next.replace(/^\/+/, '')
    next = next.replace(/\/+$/, '')
    return next
  }

  const schedulePreview = () => {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current)
    }
    previewTimerRef.current = window.setTimeout(requestPreview, 150)
  }

  const getSelectedModeIds = () => modeIds

  const fetchForCollection = (name: string) => {
    if (!name) return
    parent.postMessage({ pluginMessage: { type: 'get-groups', collectionName: name } }, '*')
    parent.postMessage({ pluginMessage: { type: 'get-modes', collectionName: name } }, '*')
  }

  const savePrefs = (next: SavedPrefs) => {
    setSavedPrefs(next)
    parent.postMessage({ pluginMessage: { type: 'save-preferences', ...next } }, '*')
  }

  const validate = () => {
    const oldP = normalizePrefix(oldAliasPrefix)
    const newP = normalizePrefix(newAliasPrefix)
    const last = (newLastSegment || '').trim()

    let hasAnyError = false

    if (!oldP) {
      setOldError('Enter an old alias prefix.')
      hasAnyError = true
    } else {
      setOldError('')
    }

    if (!matchAnywhere && last.includes('/')) {
      setLastError('Last segment cannot contain "/".')
      hasAnyError = true
    } else {
      setLastError('')
    }

    if (!newP && (!last || matchAnywhere)) {
      setNewError('Provide a new prefix and/or a new last segment.')
      hasAnyError = true
    } else if (newP && newP === oldP && (!last || matchAnywhere)) {
      setNewError('New prefix must differ from old (or set a new last segment).')
      hasAnyError = true
    } else {
      setNewError('')
    }

    return !hasAnyError
  }

  const requestPreview = () => {
    const oldP = normalizePrefix(oldAliasPrefix)
    const newP = normalizePrefix(newAliasPrefix)
    const variableFilter = (variableNameFilter || '').trim()
    if (!collectionName) return

    setOldMsg('')
    setNewMsg('')

    parent.postMessage({
      pluginMessage: {
        type: 'preview-alias-prefix-impact',
        collectionName,
        groupName,
        variableNameFilter: variableFilter,
        oldAliasPrefix: oldError ? undefined : oldP,
        newAliasPrefix: newError ? undefined : newP,
        modeIds: getSelectedModeIds(),
        matchAnywhere,
      },
    }, '*')
  }

  const handleReplace = () => {
    const isValid = validate()
    if (!isValid) return

    parent.postMessage({
      pluginMessage: {
        type: 'find-and-replace-alias-prefix',
        collectionName,
        groupName,
        variableNameFilter: (variableNameFilter || '').trim(),
        oldAliasPrefix: normalizePrefix(oldAliasPrefix),
        newAliasPrefix: normalizePrefix(newAliasPrefix),
        newLastSegment: (newLastSegment || '').trim(),
        modeIds: getSelectedModeIds(),
        matchAnywhere,
      },
    }, '*')

    savePrefs({
      collectionName,
      groupName,
      modeIds: getSelectedModeIds(),
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
          const prefs = savedPrefsRef.current
          if (prefs.collectionName && list.includes(prefs.collectionName)) {
            setCollectionName(prefs.collectionName)
          } else if (!collectionName && list.length > 0) {
            setCollectionName(list[0])
          }
          break
        }
        case 'saved-preferences': {
          const prefs = (msg.prefs || {}) as SavedPrefs
          setSavedPrefs(prefs)
          if (prefs.collectionName) {
            setCollectionName(prefs.collectionName)
          }
          if (prefs.groupName) {
            setGroupName(prefs.groupName)
          }
          if (Array.isArray(prefs.modeIds)) {
            setModeIds(prefs.modeIds)
          }
          break
        }
        case 'groups': {
          const list = msg.groups || []
          setGroups(list)
          const prefs = savedPrefsRef.current
          if (prefs.groupName && list.includes(prefs.groupName)) {
            setGroupName(prefs.groupName)
          } else if (list.length > 0) {
            setGroupName(list[0])
            savePrefs({ ...prefs, groupName: list[0] })
          }
          schedulePreview()
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
          schedulePreview()
          break
        }
        case 'preview-impact': {
          const impact = msg as PreviewImpact
          if (impact.candidateVariablesCount) {
            const count = impact.candidateVariablesCount
            setVarFilterMsg(`${count} variable${count === 1 ? '' : 's'} match the name filter`)
          } else {
            setVarFilterMsg('')
          }

          if (!oldError && oldAliasPrefix) {
            const existsOld = impact.oldPrefixVariableCount > 0
            let text = existsOld
              ? `${impact.oldPrefixVariableCount} variable${impact.oldPrefixVariableCount === 1 ? '' : 's'} found with this prefix`
              : 'No variables found with this prefix'
            const add = impact.affectedAliasEntries
              ? ` — ${impact.affectedAliasEntries} alias value${impact.affectedAliasEntries === 1 ? '' : 's'} in ${impact.affectedVariablesCount} variable${impact.affectedVariablesCount === 1 ? '' : 's'}`
              : ' — 0 aliases impacted'
            text += add
            setOldMsg(text)
          } else {
            setOldMsg('')
          }

          if (!newError && newAliasPrefix) {
            const count = impact.newPrefixVariableCount
            setNewMsg(`${count} variable${count === 1 ? '' : 's'} currently match the new prefix`)
            if (impact.newPrefixVariableNames && impact.newPrefixVariableNames.length > 0) {
              console.log('[Alias Find & Replace] New prefix matches:', impact.newPrefixVariableNames)
            } else {
              console.log('[Alias Find & Replace] New prefix matches: none')
            }
          } else {
            setNewMsg('')
          }
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [collectionName, oldAliasPrefix, newAliasPrefix, oldError, newError])

  useEffect(() => {
    if (!collectionName) return
    fetchForCollection(collectionName)
  }, [collectionName])

  useEffect(() => {
    validate()
    schedulePreview()
  }, [variableNameFilter, oldAliasPrefix, newAliasPrefix, newLastSegment, groupName, modeIds, matchAnywhere])

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*')
  }, [])

  const isReplaceDisabled = useMemo(() => {
    const oldP = normalizePrefix(oldAliasPrefix)
    const newP = normalizePrefix(newAliasPrefix)
    const last = (newLastSegment || '').trim()

    if (!oldP) return true
    if (!matchAnywhere && last.includes('/')) return true
    if (!newP && (!last || matchAnywhere)) return true
    if (newP && newP === oldP && (!last || matchAnywhere)) return true
    return false
  }, [oldAliasPrefix, newAliasPrefix, newLastSegment, matchAnywhere])

  const handleCollectionChange = (value: string) => {
    setCollectionName(value)
    const nextPrefs = { ...savedPrefsRef.current, collectionName: value, groupName: '' }
    savePrefs(nextPrefs)
    setGroupName('')
    fetchForCollection(value)
  }

  const handleGroupChange = (value: string) => {
    setGroupName(value)
    const nextPrefs = { ...savedPrefsRef.current, collectionName, groupName: value }
    savePrefs(nextPrefs)
  }

  const handleModeToggle = (id: string, checked: boolean) => {
    const next = checked ? [...modeIds, id] : modeIds.filter((modeId) => modeId !== id)
    setModeIds(next)
    savePrefs({ ...savedPrefsRef.current, collectionName, groupName, modeIds: next })
  }

  return (
    <div className="p-3" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
    }}>
      <h2 className="text-sm font-medium text-[var(--figma-color-text)] mb-3">
        Find & Replace Variable Aliases
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
            onChange={(e) => handleCollectionChange(e.target.value)}
          >
            {collections.map((collection) => (
              <option key={collection} value={collection}>{collection}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Group
          </label>
          <select
            className={selectClassName}
            value={groupName}
            onChange={(e) => handleGroupChange(e.target.value)}
          >
            {groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

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
      </div>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2'
      )}>
        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Variable name filter
          </label>
          <div className="space-y-1">
            <Input
              value={variableNameFilter}
              onChange={(e) => setVariableNameFilter(e.target.value)}
              placeholder="optional, e.g. success"
              className="text-xs h-8"
            />
            {varFilterMsg && (
              <div className="text-xs text-[var(--figma-color-text-secondary)]">
                {varFilterMsg}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Old alias prefix
          </label>
          <div className="space-y-1">
            <Input
              value={oldAliasPrefix}
              onChange={(e) => setOldAliasPrefix(normalizePrefix(e.target.value))}
              placeholder="e.g. color or color/purple"
              className="text-xs h-8"
            />
            {oldError && (
              <div className="text-xs text-[var(--figma-color-text-danger)]">
                {oldError}
              </div>
            )}
            {oldMsg && (
              <div className="text-xs text-[var(--figma-color-text-secondary)]">
                {oldMsg}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            New alias prefix
          </label>
          <div className="space-y-1">
            <Input
              value={newAliasPrefix}
              onChange={(e) => setNewAliasPrefix(normalizePrefix(e.target.value))}
              placeholder="e.g. color/blue (optional if last segment set)"
              className="text-xs h-8"
            />
            {newError && (
              <div className="text-xs text-[var(--figma-color-text-danger)]">
                {newError}
              </div>
            )}
            {newMsg && (
              <div className="text-xs text-[var(--figma-color-text-secondary)]">
                {newMsg}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            New last segment
          </label>
          <div className="space-y-1">
            <Input
              value={newLastSegment}
              onChange={(e) => setNewLastSegment(e.target.value.trim())}
              placeholder="optional, e.g. 100"
              className="text-xs h-8"
            />
            {lastError && (
              <div className="text-xs text-[var(--figma-color-text-danger)]">
                {lastError}
              </div>
            )}
            {matchAnywhere && (
              <div className="text-xs text-[var(--figma-color-text-secondary)]">
                Disabled when "Match anywhere" is enabled.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Quick setting
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--figma-color-text)]">
            <input
              type="checkbox"
              checked={matchAnywhere}
              onChange={(e) => setMatchAnywhere(e.target.checked)}
            />
            <span>Match anywhere in alias name</span>
          </label>
        </div>

        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Prefixes can be a single group (e.g. "color") or a path (e.g. "color/brand").
            No leading/trailing "/". Last segment cannot contain "/".
          </div>
          <Button
            onClick={handleReplace}
            disabled={isReplaceDisabled}
            size="sm"
            className="text-xs font-semibold"
            variant="primary"
          >
            Replace aliases
          </Button>
        </div>
      </div>
    </div>
  )
}
