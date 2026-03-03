// DS Utils Plugin - Selection Variables Feature
// Handles finding and replacing variables bound to selected nodes

import { 
  sendSelectionState, 
  collectAllNodes, 
  getOrImportVariableByName,
  hasBoundVariables,
  getBoundVariables,
  isValidVariableAlias
} from '../utils';

// ============================================================================
// MAIN PLUGIN FUNCTION
// ============================================================================

export function runSelectionVariablesPlugin() {
  // Don't show UI here - it's handled by the main plugin
  // Just set up message handlers and initialize
  
  // Set up message handlers
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "request-selection-state") {
      sendSelectionState();
      return;
    }
    if (msg.type === 'selection-find-replace-bound-vars-preview') {
      await handleSelectionFindReplacePreview(msg);
      return;
    }
    if (msg.type === 'selection-find-replace-bound-vars') {
      await handleSelectionFindReplace(msg);
      return;
    }
  };
  
  // Set up selection change listener
  figma.on('selectionchange', sendSelectionState);
  
  // Initialize
  sendSelectionState();
  
  // Notify UI to switch to selection variables feature
  figma.ui.postMessage({ type: 'switch-feature', feature: 'selection-variables' });
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

export async function handleSelectionFindReplacePreview(msg: any) {
  const { find } = msg;
  if (!find || typeof find !== 'string') {
    figma.ui.postMessage({ type: 'selection-replace-preview', affected: 0, nodes: 0 });
    return;
  }
  
  try {
    const selection = figma.currentPage.selection;
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({ type: 'selection-replace-preview', affected: 0, nodes: 0 });
      return;
    }
    
    let affected = 0;
    let nodesWith = 0;
    
    // Limit collection to prevent memory issues
    const allNodes = collectAllNodes(selection, 500, 8);
    console.log(`Processing ${allNodes.length} nodes for preview`);
    
    // Process nodes in smaller batches to prevent blocking
    const batchSize = 50;
    for (let i = 0; i < allNodes.length; i += batchSize) {
      const batch = allNodes.slice(i, i + batchSize);
      
      for (const node of batch) {
        if (!hasBoundVariables(node)) continue;
        
        const bv = getBoundVariables(node);
        if (!bv) continue;
        
        let nodeCount = 0;
        
        for (const key in bv) {
          try {
            const entry = bv[key];
            if (!entry) continue;
            
            const aliases = Array.isArray(entry) ? entry : [entry];
            
            for (const alias of aliases) {
              if (!isValidVariableAlias(alias)) continue;
              
              try {
                const variable = await figma.variables.getVariableByIdAsync(alias.id);
                if (!variable || !variable.name) continue;
                
                if (variable.name.includes(find)) {
                  affected++;
                  nodeCount++;
                }
              } catch (varError) {
                console.warn('Error getting variable:', varError);
              }
            }
          } catch (entryError) {
            console.warn('Error processing bound variable entry:', entryError);
          }
        }
        
        if (nodeCount > 0) nodesWith++;
      }
      
      // Allow other operations to process between batches
      if (i + batchSize < allNodes.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    figma.ui.postMessage({ type: 'selection-replace-preview', affected, nodes: nodesWith });
  } catch (error) {
    console.error('Error in preview:', error);
    figma.ui.postMessage({ type: 'selection-replace-preview', affected: 0, nodes: 0 });
  }
}

export async function handleSelectionFindReplace(msg: any) {
  const { find, replace } = msg;
  if (!find || typeof find !== 'string' || !replace || typeof replace !== 'string') {
    figma.notify('❌ Invalid find/replace parameters');
    return;
  }

  try {
    const selection = figma.currentPage.selection;
    if (!selection || selection.length === 0) {
      figma.notify('❌ No nodes selected');
      return;
    }

    // Limit collection to prevent memory issues
    const allNodes = collectAllNodes(selection, 500, 8);
    let changes = 0;
    let processed = 0;

    console.log(`Processing ${allNodes.length} nodes for replacement`);
    figma.notify(`🔄 Processing ${allNodes.length} nodes...`);

    // Process nodes in smaller batches
    const batchSize = 25;
    for (let i = 0; i < allNodes.length; i += batchSize) {
      const batch = allNodes.slice(i, i + batchSize);
      
      for (const node of batch) {
        if (!hasBoundVariables(node)) continue;
        
        const bv = getBoundVariables(node);
        if (!bv) continue;
        
        processed++;

        // Handle simple fields via setBoundVariable
        for (const key in bv) {
          try {
            const entry = bv[key];
            if (Array.isArray(entry)) continue; // arrays handled below
            
            if (!isValidVariableAlias(entry)) continue;
            
            const oldVar = await figma.variables.getVariableByIdAsync(entry.id);
            if (!oldVar || !oldVar.name || !oldVar.name.includes(find)) continue;
            
            const newName = oldVar.name.split(find).join(replace);
            const replacement = await getOrImportVariableByName(newName, oldVar.resolvedType as VariableResolvedDataType);
            if (!replacement) continue;
            
            try {
              (node as any).setBoundVariable(key, replacement);
              changes++;
            } catch (setBoundError) {
              console.warn('Error setting bound variable:', setBoundError);
            }
          } catch (entryError) {
            console.warn('Error processing simple bound variable:', entryError);
          }
        }

        // Handle paints for fills and strokes
        const paintProps: Array<'fills' | 'strokes'> = ['fills', 'strokes'];
        for (const prop of paintProps) {
          try {
            const entry = bv[prop];
            if (!Array.isArray(entry)) continue;
            
            const paints = (node as any)[prop] as ReadonlyArray<Paint> | undefined;
            if (!paints || !Array.isArray(paints)) continue;
            
            const copy = paints.slice();
            let paintChanged = false;
            
            for (let i = 0; i < entry.length && i < copy.length; i++) {
              const alias = entry[i];
              if (!isValidVariableAlias(alias)) continue;
              
              try {
                const oldVar = await figma.variables.getVariableByIdAsync(alias.id);
                if (!oldVar || !oldVar.name || !oldVar.name.includes(find)) continue;
                
                const newName = oldVar.name.split(find).join(replace);
                const replacement = await getOrImportVariableByName(newName, oldVar.resolvedType as VariableResolvedDataType);
                if (!replacement) continue;
                
                copy[i] = figma.variables.setBoundVariableForPaint(copy[i], 'color', replacement);
                paintChanged = true;
                changes++;
              } catch (paintError) {
                console.warn('Error processing paint variable:', paintError);
              }
            }
            
            if (paintChanged) {
              (node as any)[prop] = copy;
            }
          } catch (paintPropError) {
            console.warn('Error processing paint property:', paintPropError);
          }
        }
      }
      
      // Show progress and allow other operations to process
      if (i + batchSize < allNodes.length) {
        figma.notify(`🔄 Processed ${Math.min(i + batchSize, allNodes.length)}/${allNodes.length} nodes...`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (changes > 0) {
      figma.notify(`✅ Updated ${changes} bound variable${changes === 1 ? '' : 's'} in ${processed} node${processed === 1 ? '' : 's'}`);
    } else {
      figma.notify('ℹ️ No matching bound variables found to replace');
    }
  } catch (error) {
    console.error('Error in find/replace:', error);
    figma.notify(`❌ Error during replacement: ${(error as Error).message}`);
  }
}
