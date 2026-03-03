import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@ui/components/ui/Button'
import { cn } from '@ui/lib/utils'

interface Mode {
  id: string
  name: string
}

export function CopyMode() {
  const [collections, setCollections] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [modes, setModes] = useState<Mode[]>([])

  const [collectionName, setCollectionName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [sourceModeId, setSourceModeId] = useState('')
  const [targetModeIds, setTargetModeIds] = useState<string[]>([])

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
    parent.postMessage({ pluginMessage: { type: 'get-groups-for-copy-mode', collectionName: name } }, '*')
  }

  const requestModes = (name: string) => {
    if (!name) return
    parent.postMessage({ pluginMessage: { type: 'get-modes-for-copy-mode', collectionName: name } }, '*')
  }

  const handleApply = () => {
    if (!collectionName || !sourceModeId || targetModeIds.length === 0) return
    parent.postMessage({
      pluginMessage: {
        type: 'copy-mode-apply',
        collectionName,
        groupName,
        sourceModeId,
        targetModeIds,
      },
    }, '*')
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
        case 'groups': {
          const list = msg.groups || []
          setGroups(list)
          if (!groupName && list.length > 0) {
            setGroupName(list[0])
          }
          break
        }
        case 'modes': {
          const list = msg.modes || []
          setModes(list)
          if (!sourceModeId && list.length > 0) {
            setSourceModeId(list[0].id)
          }
          const nextTargets = targetModeIds.filter((id) => list.some((mode: Mode) => mode.id === id))
          setTargetModeIds(nextTargets)
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [collectionName, groupName, sourceModeId, targetModeIds])

  useEffect(() => {
    if (!collectionName) return
    requestGroups(collectionName)
    requestModes(collectionName)
  }, [collectionName])

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*')
  }, [])

  useEffect(() => {
    setTargetModeIds((prev) => prev.filter((id) => id !== sourceModeId))
  }, [sourceModeId])

  const targetModes = useMemo(() => modes.filter((mode) => mode.id !== sourceModeId), [modes, sourceModeId])

  const handleTargetToggle = (id: string, checked: boolean) => {
    const next = checked ? [...targetModeIds, id] : targetModeIds.filter((modeId) => modeId !== id)
    setTargetModeIds(next)
  }

  const isApplyDisabled = !collectionName || !sourceModeId || targetModeIds.length === 0

  return (
    <div className="p-3" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
    }}>
      <h2 className="text-sm font-medium text-[var(--figma-color-text)] mb-3">
        Copy Mode
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
            Group (optional)
          </label>
          <select
            className={selectClassName}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          >
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Source mode
          </label>
          <select
            className={selectClassName}
            value={sourceModeId}
            onChange={(e) => setSourceModeId(e.target.value)}
          >
            {modes.map((mode) => (
              <option key={mode.id} value={mode.id}>{mode.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Target modes (checked = paste aliases):
          </div>
          <div className={cn(
            'max-h-[140px] overflow-auto rounded-md p-2 space-y-1',
            'bg-[var(--figma-color-bg-secondary)]',
            'border border-[var(--figma-color-border)]'
          )}>
            {targetModes.length === 0 ? (
              <div className="text-xs text-[var(--figma-color-text-tertiary)]">
                No other modes available
              </div>
            ) : (
              targetModes.map((mode) => {
                const checked = targetModeIds.includes(mode.id)
                return (
                  <label key={mode.id} className="flex items-center gap-2 text-xs text-[var(--figma-color-text)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleTargetToggle(mode.id, e.target.checked)}
                    />
                    <span>{mode.name}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Copies alias values from the source mode into selected target modes.
          </div>
          <Button
            onClick={handleApply}
            disabled={isApplyDisabled}
            size="sm"
            className="text-xs font-semibold"
            variant="primary"
          >
            Copy mode
          </Button>
        </div>
      </div>
    </div>
  )
}
