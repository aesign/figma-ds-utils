import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@ui/components/ui/Button'
import { cn } from '@ui/lib/utils'

interface Mode {
  id: string
  name: string
}

export function MapVariables() {
  const [collections, setCollections] = useState<string[]>([])
  const [sourceGroups, setSourceGroups] = useState<string[]>([])
  const [targetGroups, setTargetGroups] = useState<string[]>([])
  const [targetModes, setTargetModes] = useState<Mode[]>([])

  const [sourceCollectionName, setSourceCollectionName] = useState('')
  const [sourceGroup, setSourceGroup] = useState('')
  const [targetCollectionName, setTargetCollectionName] = useState('')
  const [targetGroup, setTargetGroup] = useState('')
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

  const requestSourceGroups = (name: string) => {
    if (!name) return
    parent.postMessage({ pluginMessage: { type: 'get-source-groups', collectionName: name } }, '*')
  }

  const requestTargetGroups = (name: string) => {
    if (!name) return
    parent.postMessage({ pluginMessage: { type: 'get-target-groups', collectionName: name } }, '*')
  }

  const requestTargetModes = (name: string) => {
    if (!name) return
    parent.postMessage({ pluginMessage: { type: 'get-target-modes', collectionName: name } }, '*')
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data ? event.data.pluginMessage : undefined
      if (!msg) return

      switch (msg.type) {
        case 'collections': {
          const list = msg.collections || []
          setCollections(list)
          if (!sourceCollectionName && list.length > 0) {
            setSourceCollectionName(list[0])
          }
          if (!targetCollectionName && list.length > 0) {
            setTargetCollectionName(list[0])
          }
          break
        }
        case 'groups': {
          const list = msg.groups || []
          if (msg.requestedFor === 'source') {
            setSourceGroups(list)
            if (!sourceGroup && list.length > 0) {
              setSourceGroup(list[0])
            }
          } else if (msg.requestedFor === 'target') {
            setTargetGroups(list)
          }
          break
        }
        case 'modes': {
          const list = msg.modes || []
          setTargetModes(list)
          const next = targetModeIds.filter((id) => list.some((mode: Mode) => mode.id === id))
          setTargetModeIds(next)
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sourceCollectionName, targetCollectionName, sourceGroup, targetModeIds])

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*')
  }, [])

  useEffect(() => {
    if (!sourceCollectionName) return
    requestSourceGroups(sourceCollectionName)
  }, [sourceCollectionName])

  useEffect(() => {
    if (!targetCollectionName) return
    requestTargetGroups(targetCollectionName)
    requestTargetModes(targetCollectionName)
    setTargetGroup('')
    setTargetModeIds([])
  }, [targetCollectionName])

  const handleTargetModeToggle = (id: string, checked: boolean) => {
    const next = checked ? [...targetModeIds, id] : targetModeIds.filter((modeId) => modeId !== id)
    setTargetModeIds(next)
  }

  const handleApply = () => {
    if (!sourceCollectionName || !sourceGroup || !targetCollectionName) return
    parent.postMessage({
      pluginMessage: {
        type: 'map-variables-apply',
        sourceCollectionName,
        sourceGroup,
        targetCollectionName,
        targetGroup,
        targetModeIds,
      },
    }, '*')
  }

  const isApplyDisabled = !sourceCollectionName || !sourceGroup || !targetCollectionName

  const targetModeSummary = useMemo(() => {
    if (targetModeIds.length === 0) return 'All modes'
    const names = targetModes
      .filter((mode) => targetModeIds.includes(mode.id))
      .map((mode) => mode.name)
    return names.length > 0 ? names.join(', ') : 'All modes'
  }, [targetModeIds, targetModes])

  return (
    <div className="p-3" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
    }}>
      <h2 className="text-sm font-medium text-[var(--figma-color-text)] mb-3">
        Map Variables
      </h2>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2'
      )}>
        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Source collection
          </label>
          <select
            className={selectClassName}
            value={sourceCollectionName}
            onChange={(e) => setSourceCollectionName(e.target.value)}
          >
            {collections.map((collection) => (
              <option key={collection} value={collection}>{collection}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Source group
          </label>
          <select
            className={selectClassName}
            value={sourceGroup}
            onChange={(e) => setSourceGroup(e.target.value)}
          >
            <option value="">Select group</option>
            {sourceGroups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Target collection
          </label>
          <select
            className={selectClassName}
            value={targetCollectionName}
            onChange={(e) => setTargetCollectionName(e.target.value)}
          >
            {collections.map((collection) => (
              <option key={collection} value={collection}>{collection}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Target group (optional)
          </label>
          <select
            className={selectClassName}
            value={targetGroup}
            onChange={(e) => setTargetGroup(e.target.value)}
          >
            <option value="">No group</option>
            {targetGroups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Target modes (optional): {targetModeSummary}
          </div>
          <div className={cn(
            'max-h-[140px] overflow-auto rounded-md p-2 space-y-1',
            'bg-[var(--figma-color-bg-secondary)]',
            'border border-[var(--figma-color-border)]'
          )}>
            {targetModes.length === 0 ? (
              <div className="text-xs text-[var(--figma-color-text-tertiary)]">
                No modes available
              </div>
            ) : (
              targetModes.map((mode) => {
                const checked = targetModeIds.includes(mode.id)
                return (
                  <label key={mode.id} className="flex items-center gap-2 text-xs text-[var(--figma-color-text)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleTargetModeToggle(mode.id, e.target.checked)}
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
            Maps source group subgroups to target modes by name, creating variables as needed.
          </div>
          <Button
            onClick={handleApply}
            disabled={isApplyDisabled}
            size="sm"
            className="text-xs font-semibold"
            variant="primary"
          >
            Map variables
          </Button>
        </div>
      </div>
    </div>
  )
}
