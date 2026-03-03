// DS Utils Plugin - Map Variables Feature
// Maps variables from a source collection/group into a target collection as aliases

import {
  sendCollectionsToUi,
  sendModesForCollectionToUi,
  variableNameHasGroup,
  startsWithPrefix,
  getGroupsForCollection,
} from '../utils';

type MapVariablesMessage = {
  sourceCollectionName: string;
  sourceGroup: string;
  targetCollectionName: string;
  targetGroup?: string;
  targetModeIds?: string[];
};

// ============================================================================
// MAIN PLUGIN FUNCTION
// ============================================================================

export function runMapVariablesPlugin() {
  if (figma.editorType === 'figma') {
    figma.showUI(__html__, {
      width: 440,
      height: 460,
      title: 'DS Utils - Map Variables',
      themeColors: true,
    });
  }

  figma.ui.postMessage({ type: 'switch-feature', feature: 'map-variables' });

  figma.ui.onmessage = async (msg) => {
    if (msg.type === 'request-collections') {
      await sendCollectionsToUi();
      return;
    }
    if (msg.type === 'get-source-groups') {
      const collectionName = (msg as { collectionName: string }).collectionName;
      const groups = await getGroupsForCollection(collectionName);
      figma.ui.postMessage({ type: 'groups', groups, requestedFor: 'source' });
      return;
    }
    if (msg.type === 'get-target-groups') {
      const collectionName = (msg as { collectionName: string }).collectionName;
      const groups = await getGroupsForCollection(collectionName);
      figma.ui.postMessage({ type: 'groups', groups, requestedFor: 'target' });
      return;
    }
    if (msg.type === 'get-target-modes') {
      await sendModesForCollectionToUi((msg as { collectionName: string }).collectionName);
      return;
    }
    if (msg.type === 'map-variables-apply') {
      await handleMapVariablesApply(msg as MapVariablesMessage);
      return;
    }
  };

  sendCollectionsToUi();
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async function handleMapVariablesApply(msg: MapVariablesMessage) {
  const {
    sourceCollectionName,
    sourceGroup,
    targetCollectionName,
    targetGroup,
    targetModeIds,
  } = msg;

  if (!sourceCollectionName || !sourceGroup || !targetCollectionName) {
    figma.notify('Select source collection, source group, and target collection.');
    return;
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const sourceCollection = collections.find((c) => c.name === sourceCollectionName);
  const targetCollection = collections.find((c) => c.name === targetCollectionName);

  if (!sourceCollection) {
    figma.notify('Source collection not found.');
    return;
  }
  if (!targetCollection) {
    figma.notify('Target collection not found.');
    return;
  }

  const targetModesByName = new Map<string, string>();
  for (const mode of targetCollection.modes) {
    targetModesByName.set(mode.name, mode.modeId);
  }

  const targetModeFilter = Array.isArray(targetModeIds) && targetModeIds.length > 0
    ? new Set<string>(targetModeIds)
    : null;

  const sourceVariables = [];
  for (const variableId of sourceCollection.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId);
    if (!v) continue;
    if (!variableNameHasGroup(v.name, sourceGroup)) continue;
    if (!startsWithPrefix(v.name, sourceGroup)) continue;
    sourceVariables.push(v);
  }

  const missingModeNames = new Set<string>();
  for (const v of sourceVariables) {
    const remainder = v.name === sourceGroup
      ? ''
      : v.name.slice(sourceGroup.length + 1);
    if (!remainder) continue;
    const modeName = remainder.split('/')[0];
    if (!targetModesByName.has(modeName)) {
      missingModeNames.add(modeName);
    }
  }

  if (missingModeNames.size > 0) {
    const names = Array.from(missingModeNames).sort((a, b) => a.localeCompare(b));
    figma.notify(`Target collection missing mode(s): ${names.join(', ')}`);
    return;
  }

  const targetVariables = [];
  for (const variableId of targetCollection.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(variableId);
    if (v) targetVariables.push(v);
  }
  const targetMap = new Map<string, Variable>();
  for (const v of targetVariables) {
    targetMap.set(v.name, v);
  }

  let created = 0;
  const updatedTargetIds = new Set<string>();
  let mappedAliases = 0;
  let skipped = 0;

  for (const sourceVar of sourceVariables) {
    const remainder = sourceVar.name === sourceGroup
      ? ''
      : sourceVar.name.slice(sourceGroup.length + 1);
    if (!remainder) {
      skipped++;
      continue;
    }

    const parts = remainder.split('/');
    if (parts.length < 2) {
      skipped++;
      continue;
    }

    const modeName = parts[0];
    const baseName = parts.slice(1).join('/');
    if (!baseName) {
      skipped++;
      continue;
    }

    const targetModeId = targetModesByName.get(modeName) as string;
    if (targetModeFilter && !targetModeFilter.has(targetModeId)) {
      continue;
    }

    const targetName = targetGroup ? `${targetGroup}/${baseName}` : baseName;
    let targetVar = targetMap.get(targetName);
    if (!targetVar) {
      try {
        targetVar = figma.variables.createVariable(
          targetName,
          targetCollection,
          sourceVar.resolvedType as VariableResolvedDataType
        );
        targetMap.set(targetName, targetVar);
        created++;
      } catch (error) {
        skipped++;
        continue;
      }
    }

    targetVar.setValueForMode(targetModeId, { type: 'VARIABLE_ALIAS', id: sourceVar.id });
    mappedAliases++;
    updatedTargetIds.add(targetVar.id);
  }

  const skippedMsg = skipped ? `, skipped ${skipped}` : '';
  figma.notify(
    `Mapped ${mappedAliases} alias${mappedAliases === 1 ? '' : 'es'} into ${updatedTargetIds.size} variable${updatedTargetIds.size === 1 ? '' : 's'} (created ${created})${skippedMsg}`
  );
}
