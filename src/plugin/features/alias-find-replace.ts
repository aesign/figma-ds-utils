// DS Utils Plugin - Alias Find & Replace Feature
// Handles finding and replacing variable aliases based on prefix patterns

import { 
  sendCollectionsToUi, 
  sendGroupsForCollectionToUi, 
  sendModesForCollectionToUi, 
  sendSavedPreferences,
  variableNameHasGroup,
  startsWithPrefix,
  matchesVariableNameFilter,
  getOrImportVariableByName
} from '../utils';

// ============================================================================
// MAIN PLUGIN FUNCTION
// ============================================================================

export function runAliasFindReplacePlugin() {
  // Show main UI with alias-find-replace feature
  if (figma.editorType === "figma") {
    figma.showUI(__html__, {
      width: 420,
      height: 440,
      title: "DS Utils - Alias Find & Replace",
      themeColors: true,
    });
  }
  
  // Notify UI to switch to alias find replace feature
  figma.ui.postMessage({ type: 'switch-feature', feature: 'alias-find-replace' });
  
  // Set up message handlers
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "request-collections") {
      await sendCollectionsToUi();
      await sendSavedPreferences();
      return;
    }
    if (msg.type === "get-groups") {
      await sendGroupsForCollectionToUi((msg as { collectionName: string }).collectionName);
      return;
    }
    if (msg.type === "get-modes") {
      await sendModesForCollectionToUi((msg as { collectionName: string }).collectionName);
      return;
    }
    if (msg.type === 'save-preferences') {
      const { collectionName, groupName, modeIds } = msg as { collectionName?: string; groupName?: string; modeIds?: string[] };
      const prev = (await figma.clientStorage.getAsync('alias-prefs')) || {};
      const next = Object.assign({}, prev, { collectionName, groupName, modeIds });
      await figma.clientStorage.setAsync('alias-prefs', next);
      return;
    }
    if (msg.type === "preview-alias-prefix-impact") {
      await handlePreviewAliasPrefixImpact(msg);
      return;
    }
    if (msg.type === "find-and-replace-alias-prefix") {
      await handleFindAndReplaceAliasPrefix(msg);
      return;
    }
  };
  
  // Initialize
  sendCollectionsToUi();
  sendSavedPreferences();
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async function handlePreviewAliasPrefixImpact(msg: any) {
  const {
    collectionName,
    groupName,
    variableNameFilter,
    oldAliasPrefix,
    newAliasPrefix,
    modeIds,
    matchAnywhere,
  } = msg;

  const isMatch = (name: string, search: string) => {
    if (!search) return false;
    return matchAnywhere ? name.indexOf(search) >= 0 : startsWithPrefix(name, search);
  };

  let affectedAliasEntries = 0;
  let affectedVariablesCount = 0;
  let candidateVariablesCount = 0;

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selectedCollection = collections.find(c => c.name === collectionName);
  if (!selectedCollection) {
    figma.ui.postMessage({
      type: "preview-impact",
      affectedAliasEntries: 0,
      affectedVariablesCount: 0,
      oldPrefixVariableCount: 0,
      newPrefixVariableCount: 0,
      candidateVariablesCount: 0,
    });
    return;
  }

  const modeFilter = Array.isArray(modeIds) && modeIds.length > 0 ? new Set<string>(modeIds) : null;

  for (const variableId of selectedCollection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) continue;
    if (!variableNameHasGroup(variable.name, groupName)) continue;
    if (!matchesVariableNameFilter(variable.name, variableNameFilter)) continue;

    candidateVariablesCount++;

    if (oldAliasPrefix) {
      let variableHasMatch = false;
      for (const modeId in variable.valuesByMode) {
        if (modeFilter && !modeFilter.has(modeId)) continue;
        const value = variable.valuesByMode[modeId];
        if (value && typeof value === "object" && (value as { type?: string }).type === "VARIABLE_ALIAS") {
          const aliasId = (value as { id?: string }).id as string | undefined;
          if (!aliasId) continue;
          const targetVar = await figma.variables.getVariableByIdAsync(aliasId);
          if (!targetVar) continue;
          if (!isMatch(targetVar.name, oldAliasPrefix)) continue;
          affectedAliasEntries++;
          variableHasMatch = true;
        }
      }
      if (variableHasMatch) affectedVariablesCount++;
    }
  }

  // Count variables with old and new prefixes (local + libraries)
  let oldPrefixVariableCount = 0;
  let newPrefixVariableCount = 0;
  const newPrefixVariableNames: string[] = [];
  const locals = await figma.variables.getLocalVariablesAsync();
  for (const v of locals) {
    if (oldAliasPrefix && isMatch(v.name, oldAliasPrefix)) oldPrefixVariableCount++;
    if (newAliasPrefix && isMatch(v.name, newAliasPrefix)) {
      newPrefixVariableCount++;
      newPrefixVariableNames.push(v.name);
    }
  }
  const libCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  for (const libCol of libCollections) {
    const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libCol.key);
    for (const v of vars) {
      if (oldAliasPrefix && isMatch(v.name, oldAliasPrefix)) oldPrefixVariableCount++;
      if (newAliasPrefix && isMatch(v.name, newAliasPrefix)) {
        newPrefixVariableCount++;
        newPrefixVariableNames.push(v.name);
      }
    }
  }

  figma.ui.postMessage({
    type: "preview-impact",
    affectedAliasEntries,
    affectedVariablesCount,
    oldPrefixVariableCount,
    newPrefixVariableCount,
    newPrefixVariableNames,
    candidateVariablesCount,
  });

  if (newAliasPrefix) {
    if (newPrefixVariableNames.length > 0) {
      console.log('[Alias Find & Replace] New prefix matches:', newPrefixVariableNames);
    } else {
      console.log('[Alias Find & Replace] New prefix matches: none');
    }
  }
}

async function handleFindAndReplaceAliasPrefix(msg: any) {
  const {
    collectionName,
    groupName,
    variableNameFilter,
    oldAliasPrefix,
    newAliasPrefix,
    newLastSegment,
    modeIds,
    matchAnywhere,
  } = msg;

  function computeReplacementPath(fromName: string): string {
    if (matchAnywhere) {
      return fromName.split(oldAliasPrefix).join(newAliasPrefix);
    }
    const parts = fromName.split("/");
    const last = newLastSegment && newLastSegment.length > 0 ? newLastSegment : parts[parts.length - 1];
    return newAliasPrefix ? `${newAliasPrefix}/${last}` : last;
  }

  function matchesOldAlias(name: string): boolean {
    if (!oldAliasPrefix) return false;
    return matchAnywhere ? name.indexOf(oldAliasPrefix) >= 0 : startsWithPrefix(name, oldAliasPrefix);
  }

  let replacedCount = 0;

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selectedCollection = collections.find(c => c.name === collectionName);
  if (!selectedCollection) {
    figma.notify(`Collection not found: ${collectionName}`);
    return;
  }

  const modeFilter = Array.isArray(modeIds) && modeIds.length > 0 ? new Set<string>(modeIds) : null;

  for (const variableId of selectedCollection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) continue;
    if (!variableNameHasGroup(variable.name, groupName)) continue;
    if (!matchesVariableNameFilter(variable.name, variableNameFilter)) continue;

    let updated = false;
    for (const modeId in variable.valuesByMode) {
      if (modeFilter && !modeFilter.has(modeId)) continue;
      const value = variable.valuesByMode[modeId];
      if (
        value &&
        typeof value === "object" &&
        (value as { type?: string }).type === "VARIABLE_ALIAS"
      ) {
        const aliasId = (value as { id?: string }).id as string | undefined;
        if (!aliasId) continue;
        const targetVar = await figma.variables.getVariableByIdAsync(aliasId);
        if (!targetVar) continue;
        const targetName = targetVar.name;
        if (!matchesOldAlias(targetName)) continue;

        const desiredType = targetVar.resolvedType as VariableResolvedDataType;
        const replacementPath = computeReplacementPath(targetName);
        const replacementVar = await getOrImportVariableByName(replacementPath, desiredType);
        if (!replacementVar) {
          console.log(
            '[Alias Find & Replace] Missing replacement variable',
            {
              variable: variable.name,
              modeId,
              oldAliasTarget: targetName,
              replacementPath,
              desiredType,
            }
          );
          continue;
        }

        variable.setValueForMode(modeId, { type: "VARIABLE_ALIAS", id: replacementVar.id });
        console.log(
          '[Alias Find & Replace] Updated alias',
          {
            variable: variable.name,
            modeId,
            oldAliasTarget: targetName,
            newAliasTarget: replacementVar.name,
          }
        );
        updated = true;
      }
    }

    if (updated) replacedCount++;
  }

  figma.notify(`Replaced ${replacedCount} variable alias${replacedCount === 1 ? '' : 'es'}`);
}
