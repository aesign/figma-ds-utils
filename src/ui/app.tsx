import { SelectionVariables } from "@ui/components/features/SelectionVariables";
import { CollectionAnalyzer } from "@ui/components/features/CollectionAnalyzer";
import { AliasFindReplace } from "@ui/components/features/AliasFindReplace";
import { DuplicateRename } from "@ui/components/features/DuplicateRename";
import { AddPalette } from "@ui/components/features/AddPalette";
import { MapPalette } from "@ui/components/features/MapPalette";
import { CopyAliases } from "@ui/components/features/CopyAliases";
import { CopyMode } from "@ui/components/features/CopyMode";
import { MapVariables } from "@ui/components/features/MapVariables";
import { Networker } from "monorepo-networker";
import { useEffect, useState } from "react";

import "@ui/styles/main.scss";

function App() {
  const [currentFeature, setCurrentFeature] = useState<string | null>(null);

  useEffect(() => {
    // Listen for feature switching messages from plugin
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data ? event.data.pluginMessage : undefined;
      if (msg && msg.type === 'switch-feature') {
        setCurrentFeature(msg.feature);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Feature routing
  const renderFeature = () => {
    switch (currentFeature) {
      case 'selection-variables':
        return <SelectionVariables />;
      case 'alias-find-replace':
        return <AliasFindReplace />;
      case 'duplicate-rename':
        return <DuplicateRename />;
      case 'add-palette':
        return <AddPalette />;
      case 'map-palette':
        return <MapPalette />;
      case 'copy-aliases':
        return <CopyAliases />;
      case 'copy-mode':
        return <CopyMode />;
      case 'map-variables':
        return <MapVariables />;
      case 'analyze-collections':
        return <CollectionAnalyzer />;
      default:
        return (
          <div className="p-4 text-center">
            <h2 className="text-lg font-semibold mb-2 text-[var(--figma-color-text)]">
              DS Utils
            </h2>
            <p className="text-sm text-[var(--figma-color-text-secondary)]">
              Select a feature from the Figma plugin menu
            </p>
            <p className="text-xs text-[var(--figma-color-text-tertiary)] mt-2">
              Current side: {Networker.getCurrentSide().name}
            </p>
          </div>
        );
    }
  };

  return (
    <div 
      className="min-h-screen"
      style={{
        background: 'var(--figma-color-bg)',
        color: 'var(--figma-color-text)',
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {renderFeature()}
    </div>
  );
}

export default App;
