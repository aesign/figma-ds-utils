import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@ui/components/ui/Button'
import { cn } from '@ui/lib/utils'

interface GroupMeta {
  name: string
  depth: number
  count: number
}

interface Mode {
  id: string
  name: string
}

export function CopyAliases() {
  const [collections, setCollections] = useState<string[]>([])
  const [groups, setGroups] = useState<GroupMeta[]>([])
  const [modes, setModes] = useState<Mode[]>([])
  const [collectionName, setCollectionName] = useState('')
  const [sourceGroup, setSourceGroup] = useState('')
  const [targetGroup, setTargetGroup] = useState('')
  const [modeIds, setModeIds] = useState<string[]>([])

  const selectClassName = cn(
    'flex h-9 w-full rounded-md border px-3 py-1',
    'text-sm transition-colors focus-visible:outline-none focus-visible:ring-1',
    'bg-[var(--figma-color-bg)]',
    'border-[var(--figma-color-border)]',
    'text-[var(--figma-color-text)]',
    'focus-visible:border-[var(--figma-color-border-brand-strong)]',
    'focus-visible:ring-[var(--figma-color-border-brand-strong)]'
  )

  const requestGroups = (name: string) => {
    if (!name) return
    parent.postMessage({ pluginMessage: { type: 'get-groups-for-copy', collectionName: name } }, '*')
  }

  const requestModes = (name: string) => {
    if (!name) return
    parent.postMessage({ pluginMessage: { type: 'get-modes-for-copy-aliases', collectionName: name } }, '*')
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data ? event.data.pluginMessage : undefined
      if (!msg) return

      switch (msg.type) {
        case 'collections': {
          const list = msg.collections || []
          setCollections(list)
          if (!collectionName && list.length > 0) {
            setCollectionName(list[0])
          }
          break
        }
        case 'copy-groups': {
          const list = (msg.groups || []) as GroupMeta[]
          setGroups(list)
          break
        }
        case 'modes': {
          const list = msg.modes || []
          setModes(list)
          const next = list.map((mode: Mode) => mode.id)
          setModeIds(next)
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [collectionName])

  useEffect(() => {
    if (!collectionName) return
    requestGroups(collectionName)
    requestModes(collectionName)
  }, [collectionName])

  useEffect(() => {
    setTargetGroup('')
  }, [sourceGroup, collectionName])

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*')
  }, [])

  const sourceMeta = useMemo(
    () => groups.find((group) => group.name === sourceGroup),
    [groups, sourceGroup]
  )

  const targetOptions = useMemo(() => {
    if (!sourceMeta) return []
    return groups.filter((group) => {
      if (group.name === sourceGroup) return false
      return group.depth === sourceMeta.depth && group.count === sourceMeta.count
    })
  }, [groups, sourceMeta, sourceGroup])

  const handleApply = () => {
    if (!collectionName || !sourceGroup || !targetGroup) return
    parent.postMessage({
      pluginMessage: {
        type: 'copy-aliases-apply',
        collectionName,
        sourceGroup,
        targetGroup,
        modeIds,
      },
    }, '*')
  }

  const isApplyDisabled = !collectionName || !sourceGroup || !targetGroup

  return (
    <div className="p-3" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
    }}>
      <h2 className="text-sm font-medium text-[var(--figma-color-text)] mb-3">
        Copy Aliases
      </h2>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2'
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
            Source group
          </label>
          <select
            className={selectClassName}
            value={sourceGroup}
            onChange={(e) => setSourceGroup(e.target.value)}
          >
            <option value="">Select group</option>
            {groups.map((group) => (
              <option key={group.name} value={group.name}>
                {group.name} ({group.count})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Target group
          </label>
          <select
            className={selectClassName}
            value={targetGroup}
            onChange={(e) => setTargetGroup(e.target.value)}
            disabled={!sourceGroup}
          >
            <option value="">Select group</option>
            {targetOptions.map((group) => (
              <option key={group.name} value={group.name}>
                {group.name} ({group.count})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Modes (checked = copied):
          </div>
          <div className={cn(
            'max-h-[140px] overflow-auto rounded-md p-2 space-y-1',
            'bg-[var(--figma-color-bg-secondary)]',
            'border border-[var(--figma-color-border)]'
          )}>
            {modes.length === 0 ? (
              <div className="text-xs text-[var(--figma-color-text-tertiary)]">
                No modes available
              </div>
            ) : (
              modes.map((mode) => {
                const checked = modeIds.includes(mode.id)
                return (
                  <label key={mode.id} className="flex items-center gap-2 text-xs text-[var(--figma-color-text)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...modeIds, mode.id]
                          : modeIds.filter((id) => id !== mode.id)
                        setModeIds(next)
                      }}
                    />
                    <span>{mode.name}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>

        {sourceGroup && targetOptions.length === 0 && (
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            No eligible target groups (must match depth and variable count).
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Copies alias or raw values from source to target by matching relative paths.
          </div>
          <Button
            onClick={handleApply}
            disabled={isApplyDisabled}
            size="sm"
            className="text-xs font-semibold"
            variant="primary"
          >
            Copy aliases
          </Button>
        </div>
      </div>
    </div>
  )
}
