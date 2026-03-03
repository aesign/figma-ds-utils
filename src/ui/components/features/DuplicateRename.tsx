import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@ui/components/ui/Button'
import { Input } from '@ui/components/ui/Input'
import { cn } from '@ui/lib/utils'

export function DuplicateRename() {
  const [collections, setCollections] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [collectionName, setCollectionName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [findValue, setFindValue] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [previewNames, setPreviewNames] = useState<string[]>([])

  const previewTimerRef = useRef<number | null>(null)

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
    parent.postMessage({ pluginMessage: { type: 'get-groups-for-dup', collectionName: name } }, '*')
  }

  const requestPreview = () => {
    if (!collectionName || !findValue.trim()) {
      setPreviewNames([])
      return
    }
    parent.postMessage({
      pluginMessage: {
        type: 'duplicate-rename-preview',
        collectionName,
        groupName,
        find: findValue.trim(),
      },
    }, '*')
  }

  const schedulePreview = () => {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current)
    }
    previewTimerRef.current = window.setTimeout(requestPreview, 150)
  }

  const handleApply = () => {
    if (!collectionName || !findValue.trim()) return
    parent.postMessage({
      pluginMessage: {
        type: 'duplicate-rename-apply',
        collectionName,
        groupName,
        find: findValue.trim(),
        replace: replaceValue,
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
          schedulePreview()
          break
        }
        case 'duplicate-preview': {
          setPreviewNames(msg.names || [])
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [collectionName, groupName])

  useEffect(() => {
    if (!collectionName) return
    requestGroups(collectionName)
  }, [collectionName])

  useEffect(() => {
    schedulePreview()
  }, [findValue, groupName, collectionName])

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*')
  }, [])

  const previewCount = previewNames.length
  const isApplyDisabled = !collectionName || !findValue.trim()

  return (
    <div className="p-3" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
    }}>
      <h2 className="text-sm font-medium text-[var(--figma-color-text)] mb-3">
        Duplicate & Rename
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
            Group
          </label>
          <select
            className={selectClassName}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          >
            {groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={cn(
        'bg-[var(--figma-color-bg)]',
        'border border-[var(--figma-color-border)]',
        'rounded-lg p-3 space-y-2'
      )}>
        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Find
          </label>
          <Input
            value={findValue}
            onChange={(e) => setFindValue(e.target.value)}
            placeholder="e.g. /old/"
            className="text-xs h-8"
          />
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
            Replace with
          </label>
          <Input
            value={replaceValue}
            onChange={(e) => setReplaceValue(e.target.value)}
            placeholder="e.g. /new/"
            className="text-xs h-8"
          />
        </div>

        <div className="space-y-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Preview {previewCount ? `(${previewCount})` : ''}
          </div>
          <div className={cn(
            'max-h-[140px] overflow-auto rounded-md p-2 space-y-1',
            'bg-[var(--figma-color-bg-secondary)]',
            'border border-[var(--figma-color-border)]'
          )}>
            {previewCount === 0 ? (
              <div className="text-xs text-[var(--figma-color-text-tertiary)]">
                No matches yet
              </div>
            ) : (
              previewNames.map((name) => (
                <div key={name} className="text-xs text-[var(--figma-color-text)]">
                  {name}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-[var(--figma-color-text-secondary)]">
            Duplicates variables containing the find text and renames them.
          </div>
          <Button
            onClick={handleApply}
            disabled={isApplyDisabled}
            size="sm"
            className="text-xs font-semibold"
            variant="primary"
          >
            Duplicate & Rename
          </Button>
        </div>
      </div>
    </div>
  )
}
