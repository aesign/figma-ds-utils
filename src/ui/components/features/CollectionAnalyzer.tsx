import React, { useState, useEffect } from 'react';
import { cn } from '@ui/lib/utils';
import { Button } from '@ui/components/ui/Button';

// ============================================================================
// TYPES
// ============================================================================

interface CollectionMode {
  id: string;
  name: string;
}

interface CollectionAnalysis {
  name: string;
  type: 'local' | 'library';
  modes: CollectionMode[];
  variableCount: number;
  variableTypes: {
    COLOR: number;
    FLOAT: number;
    STRING: number;
    BOOLEAN: number;
  };
  semanticCategory?: 'theme' | 'material' | 'appearance' | 'content' | 'other';
  structure: {
    groups: string[];
    maxDepth: number;
    commonPrefixes: string[];
  };
}

interface SystemAnalysis {
  collections: CollectionAnalysis[];
  themes: {
    collectionName: string;
    modes: CollectionMode[];
  } | null;
  materials: {
    collectionName: string;
    modes: CollectionMode[];
  } | null;
  appearances: {
    collectionName: string;
    modes: CollectionMode[];
  } | null;
  totalCollections: number;
  lastAnalyzed: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CollectionAnalyzer() {
  const [analysis, setAnalysis] = useState<SystemAnalysis | null>(null);
  const [css, setCss] = useState<string>('');
  const [html, setHtml] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'themes' | 'css' | 'html'>('overview');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data ? event.data.pluginMessage : undefined;
      if (!message) return;

      switch (message.type) {
        case 'collection-analysis-complete':
          setAnalysis(message.analysis);
          setCss(message.css);
          setHtml(message.html);
          setIsAnalyzing(false);
          break;
        case 'theme-changed':
          console.log('Theme changed to:', message.theme);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const runAnalysis = () => {
    setIsAnalyzing(true);
    parent.postMessage({
      pluginMessage: { type: 'run-analysis' }
    }, '*');
  };

  const setTheme = (themeName: string) => {
    parent.postMessage({
      pluginMessage: { type: 'set-theme', theme: themeName }
    }, '*');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!analysis) {
    return (
      <div className="p-4" style={{
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: '12px'
      }}>
        <div className="text-center">
          <div className={cn(
            'w-16 h-16 rounded-full mb-4 mx-auto flex items-center justify-center',
            'bg-[var(--figma-color-bg-secondary)]'
          )}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-[var(--figma-color-text-secondary)]">
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          
          <h2 className="text-sm font-medium text-[var(--figma-color-text)] mb-2">
            Collection Analyzer
          </h2>
          
          <p className="text-xs text-[var(--figma-color-text-secondary)] mb-4 max-w-[280px] mx-auto">
            Discover and analyze your Figma variable collections, modes, and semantic structures
          </p>
          
          <Button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            variant="primary"
            size="sm"
            className="text-xs font-semibold"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Collections'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px'
    }}>
      {/* Header */}
      <div className="p-3 border-b border-[var(--figma-color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-[var(--figma-color-text)]">
              Collection Analysis
            </h2>
            <p className="text-xs text-[var(--figma-color-text-secondary)]">
              {analysis.totalCollections} collections • {new Date(analysis.lastAnalyzed).toLocaleTimeString()}
            </p>
          </div>
          <Button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            size="sm"
            className="text-xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--figma-color-border)]">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'themes', label: 'Themes' },
          { key: 'css', label: 'CSS' },
          { key: 'html', label: 'HTML' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key as any)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              selectedTab === tab.key
                ? 'border-[var(--figma-color-border-brand)] text-[var(--figma-color-text-brand)]'
                : 'border-transparent text-[var(--figma-color-text-secondary)] hover:text-[var(--figma-color-text)]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {selectedTab === 'overview' && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(
                'p-3 rounded-lg border',
                'bg-[var(--figma-color-bg)]',
                'border-[var(--figma-color-border)]'
              )}>
                <div className="text-lg font-semibold text-[var(--figma-color-text)]">
                  {analysis.totalCollections}
                </div>
                <div className="text-xs text-[var(--figma-color-text-secondary)]">
                  Total Collections
                </div>
              </div>
              
              <div className={cn(
                'p-3 rounded-lg border',
                'bg-[var(--figma-color-bg)]',
                'border-[var(--figma-color-border)]'
              )}>
                <div className="text-lg font-semibold text-[var(--figma-color-text)]">
                  {analysis.collections.reduce((sum, c) => sum + c.variableCount, 0)}
                </div>
                <div className="text-xs text-[var(--figma-color-text-secondary)]">
                  Total Variables
                </div>
              </div>
            </div>

            {/* Semantic Collections */}
            <div>
              <h3 className="text-sm font-medium text-[var(--figma-color-text)] mb-2">
                Semantic Collections
              </h3>
              <div className="space-y-2">
                {analysis.themes && (
                  <div className={cn(
                    'p-3 rounded-lg border',
                    'bg-[var(--figma-color-bg-brand-tertiary)]',
                    'border-[var(--figma-color-border-brand)]'
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-[var(--figma-color-text-brand)]">
                          Themes
                        </div>
                        <div className="text-xs text-[var(--figma-color-text-secondary)]">
                          {analysis.themes.collectionName}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--figma-color-text-brand)]">
                        {analysis.themes.modes.length} modes
                      </div>
                    </div>
                  </div>
                )}
                
                {analysis.materials && (
                  <div className={cn(
                    'p-3 rounded-lg border',
                    'bg-[var(--figma-color-bg)]',
                    'border-[var(--figma-color-border)]'
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-[var(--figma-color-text)]">
                          Materials
                        </div>
                        <div className="text-xs text-[var(--figma-color-text-secondary)]">
                          {analysis.materials.collectionName}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--figma-color-text-secondary)]">
                        {analysis.materials.modes.length} modes
                      </div>
                    </div>
                  </div>
                )}
                
                {analysis.appearances && (
                  <div className={cn(
                    'p-3 rounded-lg border',
                    'bg-[var(--figma-color-bg)]',
                    'border-[var(--figma-color-border)]'
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-[var(--figma-color-text)]">
                          Appearances
                        </div>
                        <div className="text-xs text-[var(--figma-color-text-secondary)]">
                          {analysis.appearances.collectionName}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--figma-color-text-secondary)]">
                        {analysis.appearances.modes.length} modes
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* All Collections */}
            <div>
              <h3 className="text-sm font-medium text-[var(--figma-color-text)] mb-2">
                All Collections
              </h3>
              <div className="space-y-2">
                {analysis.collections.map((collection, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg border',
                      'bg-[var(--figma-color-bg)]',
                      'border-[var(--figma-color-border)]'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-[var(--figma-color-text)]">
                        {collection.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'px-2 py-1 rounded text-xs',
                          collection.semanticCategory === 'theme'
                            ? 'bg-[var(--figma-color-bg-brand-tertiary)] text-[var(--figma-color-text-brand)]'
                            : 'bg-[var(--figma-color-bg-secondary)] text-[var(--figma-color-text-secondary)]'
                        )}>
                          {collection.semanticCategory}
                        </span>
                        <span className="text-xs text-[var(--figma-color-text-secondary)]">
                          {collection.type}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--figma-color-text-secondary)]">
                      {collection.variableCount} variables • {collection.modes.length} modes
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'themes' && analysis.themes && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-[var(--figma-color-text)] mb-2">
                Available Themes
              </h3>
              <p className="text-xs text-[var(--figma-color-text-secondary)] mb-3">
                From collection: {analysis.themes.collectionName}
              </p>
              <div className="space-y-2">
                {analysis.themes.modes.map((mode, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg border flex items-center justify-between',
                      'bg-[var(--figma-color-bg)]',
                      'border-[var(--figma-color-border)]'
                    )}
                  >
                    <div>
                      <div className="text-xs font-medium text-[var(--figma-color-text)]">
                        {mode.name}
                      </div>
                      <div className="text-xs text-[var(--figma-color-text-secondary)]">
                        ID: {mode.id}
                      </div>
                    </div>
                    <Button
                      onClick={() => setTheme(mode.name)}
                      size="sm"
                      className="text-xs"
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'css' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-[var(--figma-color-text)]">
                  CSS Custom Properties
                </h3>
                <Button
                  onClick={() => copyToClipboard(css)}
                  size="sm"
                  className="text-xs"
                >
                  Copy
                </Button>
              </div>
              <pre className={cn(
                'p-3 rounded-lg text-xs overflow-auto max-h-64',
                'bg-[var(--figma-color-bg-secondary)]',
                'border border-[var(--figma-color-border)]',
                'text-[var(--figma-color-text)]'
              )}>
                {css}
              </pre>
            </div>
          </div>
        )}

        {selectedTab === 'html' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-[var(--figma-color-text)]">
                  HTML Mode Helpers
                </h3>
                <Button
                  onClick={() => copyToClipboard(html)}
                  size="sm"
                  className="text-xs"
                >
                  Copy
                </Button>
              </div>
              <pre className={cn(
                'p-3 rounded-lg text-xs overflow-auto max-h-64',
                'bg-[var(--figma-color-bg-secondary)]',
                'border border-[var(--figma-color-border)]',
                'text-[var(--figma-color-text)]'
              )}>
                {html}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
