// DS Utils Plugin - Utility Functions
// Common functions used across different features

// ============================================================================
// COLLECTION & VARIABLE UTILITIES
// ============================================================================

export async function sendCollectionsToUi() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  figma.ui.postMessage({ type: "collections", collections: collections.map(c => c.name) });
}

export async function getGroupsForCollection(collectionName: string): Promise<string[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selected = collections.find(c => c.name === collectionName);
  if (!selected) return [];
  const unique = new Set<string>();
  for (const variableId of selected.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) continue;
    const segments = variable.name.split("/").filter(Boolean);
    if (segments.length === 0) continue;
    for (let i = 0; i < segments.length - 1; i++) {
      const prefix = segments.slice(0, i + 1).join("/");
      unique.add(prefix);
    }
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export async function sendGroupsForCollectionToUi(collectionName: string) {
  const groups = await getGroupsForCollection(collectionName);
  figma.ui.postMessage({ type: "groups", groups });
}

export async function sendModesForCollectionToUi(collectionName: string) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const selected = collections.find(c => c.name === collectionName);
  if (!selected) {
    figma.ui.postMessage({ type: "modes", modes: [] });
    return;
  }
  const modes = selected.modes.map(m => ({ id: m.modeId, name: m.name }));
  figma.ui.postMessage({ type: "modes", modes });
}

export async function sendSavedPreferences() {
  const prefs = (await figma.clientStorage.getAsync('alias-prefs')) || {};
  figma.ui.postMessage({ type: 'saved-preferences', prefs });
}

export function sendSelectionState() {
  const count = figma.currentPage.selection.length;
  figma.ui.postMessage({ type: 'selection-state', count });
}

// ============================================================================
// VARIABLE SEARCH & IMPORT UTILITIES
// ============================================================================

export async function getLocalVariableByName(name: string) {
  const locals = await figma.variables.getLocalVariablesAsync();
  for (const v of locals) {
    if (v.name === name) return v;
  }
  return null;
}

export async function ensureLibraryVariablesLoaded() {
  const libCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  const allVars: Array<{ key: string; name: string; resolvedType: VariableResolvedDataType }> = [];
  
  for (const libCol of libCollections) {
    const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libCol.key);
    for (const v of vars) {
      allVars.push({ key: v.key, name: v.name, resolvedType: v.resolvedType });
    }
  }
  
  return allVars;
}

export async function getOrImportVariableByName(name: string, desiredType: VariableResolvedDataType | null) {
  const local = await getLocalVariableByName(name);
  if (local) return local;
  
  const libraryVariables = await ensureLibraryVariablesLoaded();
  let candidateKey: string | null = null;
  
  for (const v of libraryVariables) {
    if (v.name === name && (!desiredType || v.resolvedType === desiredType)) {
      candidateKey = v.key;
      break;
    }
  }
  
  if (!candidateKey) {
    for (const v of libraryVariables) {
      if (v.name === name) {
        candidateKey = v.key;
        break;
      }
    }
  }
  
  if (!candidateKey) return null;
  const imported = await figma.variables.importVariableByKeyAsync(candidateKey);
  return imported || null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function variableNameHasGroup(variableName: string, group: string): boolean {
  if (!group) return true;
  return variableName === group || variableName.indexOf(group + "/") === 0;
}

export function startsWithPrefix(variableName: string, prefix: string): boolean {
  if (!prefix) return false;
  return variableName === prefix || variableName.indexOf(prefix + "/") === 0;
}

export function matchesVariableNameFilter(name: string, filter?: string): boolean {
  if (!filter) return true;
  return name.toLowerCase().indexOf(filter.toLowerCase()) >= 0;
}

export function replaceAll(hay: string, needle: string, rep: string) {
  return hay.split(needle).join(rep);
}

// Safe utility to check if a node has bound variables
export function hasBoundVariables(node: SceneNode): boolean {
  try {
    const bv = (node as any).boundVariables;
    return bv != null && typeof bv === 'object';
  } catch (error) {
    return false;
  }
}

// Safe utility to get bound variables from a node
export function getBoundVariables(node: SceneNode): any {
  try {
    if (!hasBoundVariables(node)) return null;
    return (node as any).boundVariables;
  } catch (error) {
    console.warn('Error accessing bound variables:', error);
    return null;
  }
}

// Safe utility to check if a variable alias is valid
export function isValidVariableAlias(alias: any): boolean {
  try {
    return alias && 
           typeof alias === 'object' && 
           alias.type === 'VARIABLE_ALIAS' && 
           typeof alias.id === 'string' &&
           alias.id.length > 0;
  } catch (error) {
    return false;
  }
}

export function collectAllNodes(selection: readonly SceneNode[], maxNodes: number = 1000, maxDepth: number = 10): SceneNode[] {
  const allNodes: SceneNode[] = [];
  
  function collect(node: SceneNode, depth: number = 0) {
    // Safety limits to prevent memory issues
    if (allNodes.length >= maxNodes || depth >= maxDepth) {
      return;
    }
    
    try {
      allNodes.push(node);
      
      // Only recurse if the node has children and we haven't hit depth limit
      if ('children' in node && depth < maxDepth) {
        const children = (node as any).children as readonly SceneNode[];
        if (children && Array.isArray(children)) {
          for (const child of children) {
            if (allNodes.length >= maxNodes) break;
            collect(child, depth + 1);
          }
        }
      }
    } catch (error) {
      console.warn('Error collecting node:', error);
    }
  }
  
  for (const node of selection) {
    if (allNodes.length >= maxNodes) break;
    collect(node, 0);
  }
  
  return allNodes;
}
