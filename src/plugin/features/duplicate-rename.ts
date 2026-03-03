// DS Utils Plugin - Duplicate & Rename Feature
// Handles duplicating variables with renamed versions

import { sendCollectionsToUi, sendGroupsForCollectionToUi, variableNameHasGroup } from '../utils';

// ============================================================================
// MAIN PLUGIN FUNCTION
// ============================================================================

export function runDuplicateRenamePlugin() {
  // Show main UI with duplicate-rename feature
  if (figma.editorType === "figma") {
    figma.showUI(__html__, {
      width: 420,
      height: 400,
      title: "DS Utils - Duplicate & Rename",
      themeColors: true,
    });
  }
  
  // Notify UI to switch to duplicate rename feature
  figma.ui.postMessage({ type: 'switch-feature', feature: 'duplicate-rename' });
  
  // Set up message handlers
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "request-collections") {
      await sendCollectionsToUi();
      return;
    }
    if (msg.type === "get-groups-for-dup") {
      await sendGroupsForCollectionToUi((msg as { collectionName: string }).collectionName);
      return;
    }
    if (msg.type === 'duplicate-rename-preview') {
      await handleDuplicateRenamePreview(msg);
      return;
    }
    if (msg.type === 'duplicate-rename-apply') {
      await handleDuplicateRenameApply(msg);
      return;
    }
  };
  
  // Initialize
  sendCollectionsToUi();
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async function handleDuplicateRenamePreview(msg: any) {
  const { collectionName, groupName, find } = msg;
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selected = collections.find(c => c.name === collectionName);
  
  if (!selected || !find) {
    figma.ui.postMessage({ type: 'duplicate-preview', names: [] });
    return;
  }
  
  const lc = find.toLowerCase();
  const names: string[] = [];
  
  for (const variableId of selected.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId);
    if (!v) continue;
    if (!variableNameHasGroup(v.name, groupName)) continue;
    if (v.name.toLowerCase().indexOf(lc) >= 0) names.push(v.name);
  }
  
  names.sort((a, b) => a.localeCompare(b));
  figma.ui.postMessage({ type: 'duplicate-preview', names });
}

async function handleDuplicateRenameApply(msg: any) {
  const { collectionName, groupName, find, replace } = msg;
  if (!find || replace === undefined) return;
  
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selected = collections.find(c => c.name === collectionName);
  if (!selected) { 
    figma.notify('Collection not found'); 
    return; 
  }

  const lc = find;
  const locals = await figma.variables.getLocalVariablesAsync();
  const existing = new Set<string>(locals.map(v => v.name));

  let created = 0;
  let skipped = 0;

  for (const variableId of selected.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId);
    if (!v) continue;
    if (!variableNameHasGroup(v.name, groupName)) continue;
    if (v.name.indexOf(lc) < 0) continue;

    const newName = v.name.split(lc).join(replace);
    if (existing.has(newName)) { 
      skipped++; 
      continue; 
    }
    
    try {
      const newVar = figma.variables.createVariable(newName, selected, v.resolvedType as VariableResolvedDataType);
      
      // Copy all mode values
      for (const modeId in v.valuesByMode) {
        const value = v.valuesByMode[modeId];
        newVar.setValueForMode(modeId, value);
      }
      
      existing.add(newName);
      created++;
    } catch (e) {
      // ignore errors on individual items
    }
  }

  figma.notify(`Created ${created} variable${created === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} existing` : ''}`);
}
