// DS Utils Plugin - Copy Aliases Feature
// Copies alias values from a source group to a target group within the same collection

import {
  sendCollectionsToUi,
  variableNameHasGroup,
  startsWithPrefix,
  sendModesForCollectionToUi,
} from '../utils';

type GroupMeta = { name: string; depth: number; count: number };

// ============================================================================
// MAIN PLUGIN FUNCTION
// ============================================================================

export function runCopyAliasesPlugin() {
  if (figma.editorType === 'figma') {
    figma.showUI(__html__, {
      width: 420,
      height: 380,
      title: 'DS Utils - Copy Aliases',
      themeColors: true,
    });
  }

  figma.ui.postMessage({ type: 'switch-feature', feature: 'copy-aliases' });

  figma.ui.onmessage = async (msg) => {
    if (msg.type === 'request-collections') {
      await sendCollectionsToUi();
      return;
    }
    if (msg.type === 'get-groups-for-copy') {
      await sendGroupsForCopy(msg);
      return;
    }
    if (msg.type === 'get-modes-for-copy-aliases') {
      await sendModesForCollectionToUi((msg as { collectionName: string }).collectionName);
      return;
    }
    if (msg.type === 'copy-aliases-apply') {
      await handleCopyAliasesApply(msg);
      return;
    }
  };

  sendCollectionsToUi();
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async function sendGroupsForCopy(msg: any) {
  const { collectionName } = msg as { collectionName: string };
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selected = collections.find((c) => c.name === collectionName);
  if (!selected) {
    figma.ui.postMessage({ type: 'copy-groups', groups: [] });
    return;
  }

  const variables = [];
  for (const variableId of selected.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId);
    if (v) variables.push(v);
  }

  const groupSet = new Set<string>();
  for (const v of variables) {
    const segments = v.name.split('/').filter(Boolean);
    if (segments.length <= 1) continue;
    for (let i = 0; i < segments.length - 1; i++) {
      const prefix = segments.slice(0, i + 1).join('/');
      groupSet.add(prefix);
    }
  }

  const groups: GroupMeta[] = [];
  for (const name of groupSet) {
    const depth = name.split('/').filter(Boolean).length;
    let count = 0;
    for (const v of variables) {
      if (startsWithPrefix(v.name, name)) count++;
    }
    groups.push({ name, depth, count });
  }

  groups.sort((a, b) => a.name.localeCompare(b.name));
  figma.ui.postMessage({ type: 'copy-groups', groups });
}

async function handleCopyAliasesApply(msg: any) {
  const { collectionName, sourceGroup, targetGroup, modeIds } = msg as {
    collectionName: string;
    sourceGroup: string;
    targetGroup: string;
    modeIds?: string[];
  };

  if (!collectionName || !sourceGroup || !targetGroup) {
    figma.notify('Select a collection, source group, and target group.');
    return;
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selected = collections.find((c) => c.name === collectionName);
  if (!selected) {
    figma.notify('Collection not found.');
    return;
  }

  const variables = [];
  for (const variableId of selected.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId);
    if (v) variables.push(v);
  }

  const nameMap = new Map<string, Variable>();
  for (const v of variables) {
    nameMap.set(v.name, v);
  }

  const modeFilter = Array.isArray(modeIds) && modeIds.length > 0 ? new Set<string>(modeIds) : null;
  let copiedValues = 0;
  let updatedVariables = 0;
  let missingTargets = 0;

  for (const sourceVar of variables) {
    if (!variableNameHasGroup(sourceVar.name, sourceGroup)) continue;

    const suffix = sourceVar.name === sourceGroup
      ? ''
      : sourceVar.name.slice(sourceGroup.length + 1);
    const targetName = suffix ? `${targetGroup}/${suffix}` : targetGroup;
    const targetVar = nameMap.get(targetName);
    if (!targetVar) {
      missingTargets++;
      continue;
    }

    let updated = false;
    const sourceModes = modeFilter ? Array.from(modeFilter) : Object.keys(sourceVar.valuesByMode);
    for (const modeId of sourceModes) {
      const value = sourceVar.valuesByMode[modeId];
      if (value === undefined || value === null) continue;
      targetVar.setValueForMode(modeId, value);
      copiedValues++;
      updated = true;
    }

    if (updated) updatedVariables++;
  }

  const missingMsg = missingTargets
    ? `, ${missingTargets} target${missingTargets === 1 ? '' : 's'} missing`
    : '';
  figma.notify(
    `Copied ${copiedValues} value${copiedValues === 1 ? '' : 's'} across ${updatedVariables} variable${updatedVariables === 1 ? '' : 's'}${missingMsg}`
  );
}
