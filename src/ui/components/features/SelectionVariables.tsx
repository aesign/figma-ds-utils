import React, { useState, useEffect } from 'react'
import { Button } from '@ui/components/ui/Button'
import { Input } from '@ui/components/ui/Input'
import { cn } from '@ui/lib/utils'

interface SelectionState {
  count: number
}

interface PreviewResult {
  affected: number
  nodes: number
}

export function SelectionVariables() {
  const [findValue, setFindValue] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [selectionState, setSelectionState] = useState<SelectionState>({ count: 0 })
  const [findMessage, setFindMessage] = useState('')
  const [replaceMessage, setReplaceMessage] = useState('')

  const updatePreview = () => {
    const find = findValue.trim()
    const replace = replaceValue.trim()

    if (!find) {
      setFindMessage('')
      setReplaceMessage('')
      return
    }

    if (!replace) {
      setReplaceMessage('Enter replacement text')
      return
    }

    setReplaceMessage('')

    // Request preview from plugin
    parent.postMessage({
      pluginMessage: {
        type: 'selection-find-replace-bound-vars-preview',
        find
      }
    }, '*')
  }

  const handleReplace = () => {
    const find = findValue.trim()
    const replace = replaceValue.trim()

    if (!find || !replace) return

    parent.postMessage({
      pluginMessage: {
        type: 'selection-find-replace-bound-vars',
        find,
        replace
      }
    }, '*')
  }

  const updateFindMessage = (affected: number, nodes: number) => {
    if (affected > 0) {
      setFindMessage(`${affected} bound variable${affected === 1 ? '' : 's'} found in ${nodes} node${nodes === 1 ? '' : 's'}`)
    } else {
      setFindMessage('No matching bound variables found')
    }
  }

  // Handle messages from plugin using standard Figma messaging
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data ? event.data.pluginMessage : undefined;
      if (!msg) return;

      if (msg.type === 'selection-state') {
        setSelectionState({ count: msg.count });
      }

      if (msg.type === 'selection-replace-preview') {
        updateFindMessage(msg.affected, msg.nodes);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [])

  // Update preview when inputs change
  useEffect(() => {
    updatePreview()
  }, [findValue, replaceValue])

  // Request initial selection state
  useEffect(() => {
    parent.postMessage({
      pluginMessage: {
        type: 'request-selection-state'
      }
    }, '*')
  }, [])

  const isReplaceDisabled = !findValue.trim() || !replaceValue.trim()

  return (
    <div className="p-3" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px'
    }}>
      {selectionState.count === 0 ? (
        // Empty state when no nodes are selected
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className={cn(
            'w-12 h-12 rounded-full mb-3 flex items-center justify-center',
            'bg-[var(--figma-color-bg-secondary)]'
          )}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--figma-color-text-secondary)]">
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-sm font-medium text-[var(--figma-color-text)] mb-1">
            No nodes selected
          </h3>
          <p className="text-xs text-[var(--figma-color-text-secondary)] max-w-[200px]">
            Select one or more nodes with bound variables to find and replace them
          </p>
        </div>
      ) : (
        // Main interface when nodes are selected
        <>
          <div className={cn(
            'bg-[var(--figma-color-bg-brand-tertiary)]',
            'border border-[var(--figma-color-border-brand)]',
            'rounded-md px-2 py-2 mb-3 text-xs',
            'text-[var(--figma-color-text-brand)]'
          )}>
            <strong>Selection detected:</strong> {selectionState.count} node(s) selected
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
              <div className="space-y-1">
                <Input
                  value={findValue}
                  onChange={(e) => setFindValue(e.target.value)}
                  placeholder="e.g. success"
                  className="text-xs h-8"
                />
                {findMessage && (
                  <div className="text-xs text-[var(--figma-color-text-secondary)]">
                    {findMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
              <label className="text-xs text-[var(--figma-color-text)] justify-self-end">
                Replace with
              </label>
              <div className="space-y-1">
                <Input
                  value={replaceValue}
                  onChange={(e) => setReplaceValue(e.target.value)}
                  placeholder="e.g. warning"
                  className="text-xs h-8"
                />
                {replaceMessage && (
                  <div className="text-xs text-[var(--figma-color-text-secondary)]">
                    {replaceMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-[var(--figma-color-text-secondary)]">
                Updates bound variables in selected nodes
              </div>
              <Button
                onClick={handleReplace}
                disabled={isReplaceDisabled}
                size="sm"
                className="text-xs font-semibold"
                variant='primary'
              >
                Replace Variables
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

