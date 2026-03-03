// DS Utils Plugin - Copy Mode Feature
// Copies alias values from one mode to selected target modes within a collection

import {
  sendCollectionsToUi,
  sendGroupsForCollectionToUi,
  sendModesForCollectionToUi,
  variableNameHasGroup,
  isValidVariableAlias,
} from '../utils';

// ============================================================================
// MAIN PLUGIN FUNCTION
// ============================================================================

export function runCopyModePlugin() {
  if (figma.editorType === 'figma') {
    figma.showUI(__html__, {
      width: 420,
      height: 420,
      title: 'DS Utils - Copy Mode',
      themeColors: true,
    });
  }

  figma.ui.postMessage({ type: 'switch-feature', feature: 'copy-mode' });

  figma.ui.onmessage = async (msg) => {
    if (msg.type === 'request-collections') {
      await sendCollectionsToUi();
      return;
    }
    if (msg.type === 'get-groups-for-copy-mode') {
      await sendGroupsForCollectionToUi((msg as { collectionName: string }).collectionName);
      return;
    }
    if (msg.type === 'get-modes-for-copy-mode') {
      await sendModesForCollectionToUi((msg as { collectionName: string }).collectionName);
      return;
    }
    if (msg.type === 'copy-mode-apply') {
      await handleCopyModeApply(msg);
      return;
    }
  };

  sendCollectionsToUi();
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async function handleCopyModeApply(msg: any) {
  const { collectionName, groupName, sourceModeId, targetModeIds } = msg as {
    collectionName: string;
    groupName?: string;
    sourceModeId: string;
    targetModeIds: string[];
  };

  if (!collectionName || !sourceModeId || !Array.isArray(targetModeIds) || targetModeIds.length === 0) {
    figma.notify('Select collection, source mode, and target modes.');
    return;
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selected = collections.find((c) => c.name === collectionName);
  if (!selected) {
    figma.notify('Collection not found.');
    return;
  }

  const targetSet = new Set<string>(targetModeIds.filter((id) => id !== sourceModeId));
  if (targetSet.size === 0) {
    figma.notify('Select at least one target mode different from the source.');
    return;
  }

  let scannedVariables = 0;
  let scopedVariables = 0;
  let sourceAliasVariables = 0;
  let copiedAliases = 0;
  let updatedVariables = 0;
  let debugSamples = 0;
  const debugSampleLimit = 10;

  for (const variableId of selected.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId);
    if (!v) continue;
    scannedVariables++;
    if (!variableNameHasGroup(v.name, groupName || '')) continue;
    scopedVariables++;

    const sourceValue = v.valuesByMode[sourceModeId];
    if (debugSamples < debugSampleLimit) {
      const isAlias = isValidVariableAlias(sourceValue);
      const type = sourceValue && typeof sourceValue === 'object'
        ? (sourceValue as { type?: string }).type
        : typeof sourceValue;
      console.log('[Copy Mode] Source value sample', {
        variable: v.name,
        modeId: sourceModeId,
        type,
        isAlias,
        raw: sourceValue,
      });
      debugSamples++;
    }
    if (!isValidVariableAlias(sourceValue)) continue;
    sourceAliasVariables++;

    let updated = false;
    for (const modeId of targetSet) {
      v.setValueForMode(modeId, sourceValue);
      copiedAliases++;
      updated = true;
    }

    if (updated) updatedVariables++;
  }

  console.log('[Copy Mode] Summary', {
    collectionName,
    groupName: groupName || '(all)',
    sourceModeId,
    targetModeIds: Array.from(targetSet),
    scannedVariables,
    scopedVariables,
    sourceAliasVariables,
    copiedAliases,
    updatedVariables,
  });

  figma.notify(
    `Copied ${copiedAliases} alias${copiedAliases === 1 ? '' : 'es'} across ${updatedVariables} variable${updatedVariables === 1 ? '' : 's'}`
  );
}
