// DS Utils Plugin - Collection Analyzer
// Dynamically discovers and analyzes Figma variable collections and their modes

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface CollectionMode {
  id: string;
  name: string;
}

export interface CollectionAnalysis {
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

export interface SystemAnalysis {
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
// COLLECTION DISCOVERY AND ANALYSIS
// ============================================================================

export async function analyzeAllCollections(): Promise<SystemAnalysis> {
  console.log('🔍 Starting comprehensive collection analysis...');
  
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  
  const analysisPromises: Promise<CollectionAnalysis>[] = [];
  
  // Analyze local collections
  for (const collection of localCollections) {
    analysisPromises.push(analyzeCollection(collection, 'local'));
  }
  
  // Analyze library collections (with limits for performance)
  const limitedLibraryCollections = libraryCollections.slice(0, 10);
  for (const collection of limitedLibraryCollections) {
    analysisPromises.push(analyzeLibraryCollection(collection));
  }
  
  const collections = await Promise.all(analysisPromises);
  
  // Identify semantic collections
  const themes = findSemanticCollection(collections, 'theme');
  const materials = findSemanticCollection(collections, 'material');
  const appearances = findSemanticCollection(collections, 'appearance');
  
  const analysis: SystemAnalysis = {
    collections,
    themes,
    materials,
    appearances,
    totalCollections: collections.length,
    lastAnalyzed: Date.now()
  };
  
  console.log('✅ Collection analysis completed:', analysis);
  return analysis;
}

async function analyzeCollection(collection: VariableCollection, type: 'local'): Promise<CollectionAnalysis> {
  console.log(`🔍 Analyzing ${type} collection: ${collection.name}`);
  
  const modes: CollectionMode[] = collection.modes.map(mode => ({
    id: mode.modeId,
    name: mode.name
  }));
  
  const variableTypes = {
    COLOR: 0,
    FLOAT: 0,
    STRING: 0,
    BOOLEAN: 0
  };
  
  const groups = new Set<string>();
  let maxDepth = 0;
  const prefixes = new Set<string>();
  
  // Analyze variables with memory safety
  const maxVariables = 200;
  const limitedVariables = collection.variableIds.slice(0, maxVariables);
  
  for (const variableId of limitedVariables) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (variable) {
        // Count variable types
        variableTypes[variable.resolvedType]++;
        
        // Analyze structure
        const segments = variable.name.split('/').filter(Boolean);
        maxDepth = Math.max(maxDepth, segments.length);
        
        if (segments.length > 1) {
          // Add group paths
          for (let i = 1; i < segments.length; i++) {
            groups.add(segments.slice(0, i).join('/'));
          }
          
          // Add common prefixes
          if (segments.length >= 2) {
            prefixes.add(segments[0]);
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Error analyzing variable:', error);
      continue;
    }
  }
  
  const semanticCategory = determineSemanticCategory(collection.name, Array.from(prefixes));
  
  return {
    name: collection.name,
    type,
    modes,
    variableCount: collection.variableIds.length,
    variableTypes,
    semanticCategory,
    structure: {
      groups: Array.from(groups).sort(),
      maxDepth,
      commonPrefixes: Array.from(prefixes).sort()
    }
  };
}

async function analyzeLibraryCollection(collection: LibraryVariableCollection): Promise<CollectionAnalysis> {
  console.log(`🔍 Analyzing library collection: ${collection.name}`);
  
  // For library collections, we have limited access
  return {
    name: collection.name,
    type: 'library',
    modes: [], // Library modes not accessible in this API
    variableCount: 0, // Not directly accessible
    variableTypes: {
      COLOR: 0,
      FLOAT: 0,
      STRING: 0,
      BOOLEAN: 0
    },
    semanticCategory: determineSemanticCategory(collection.name, []),
    structure: {
      groups: [],
      maxDepth: 0,
      commonPrefixes: []
    }
  };
}

function determineSemanticCategory(collectionName: string, prefixes: string[]): CollectionAnalysis['semanticCategory'] {
  const name = collectionName.toLowerCase();
  const allPrefixes = prefixes.map(p => p.toLowerCase());
  
  // Check for theme indicators
  if (name.includes('theme') || name.includes('semantic/theme') || 
      allPrefixes.some(p => p.includes('theme') || p.includes('mode'))) {
    return 'theme';
  }
  
  // Check for material indicators
  if (name.includes('material') || name.includes('semantic/material') ||
      allPrefixes.some(p => p.includes('material') || p.includes('surface'))) {
    return 'material';
  }
  
  // Check for appearance indicators
  if (name.includes('appearance') || name.includes('semantic/appearance') ||
      allPrefixes.some(p => p.includes('appearance') || p.includes('style'))) {
    return 'appearance';
  }
  
  // Check for content indicators
  if (name.includes('content') || name.includes('text') || name.includes('i18n') ||
      allPrefixes.some(p => p.includes('content') || p.includes('text'))) {
    return 'content';
  }
  
  return 'other';
}

function findSemanticCollection(collections: CollectionAnalysis[], category: 'theme' | 'material' | 'appearance'): { collectionName: string; modes: CollectionMode[] } | null {
  const found = collections.find(c => c.semanticCategory === category);
  if (found) {
    return {
      collectionName: found.name,
      modes: found.modes
    };
  }
  return null;
}

// ============================================================================
// MODE MANAGEMENT UTILITIES
// ============================================================================

export async function getAvailableThemes(): Promise<CollectionMode[]> {
  const analysis = await analyzeAllCollections();
  return analysis.themes?.modes || [];
}

export async function getAvailableMaterials(): Promise<CollectionMode[]> {
  const analysis = await analyzeAllCollections();
  return analysis.materials?.modes || [];
}

export async function getAvailableAppearances(): Promise<CollectionMode[]> {
  const analysis = await analyzeAllCollections();
  return analysis.appearances?.modes || [];
}

export async function setThemeMode(themeName: string): Promise<boolean> {
  try {
    const analysis = await analyzeAllCollections();
    if (!analysis.themes) {
      console.log('❌ No theme collection found');
      return false;
    }
    
    const themeMode = analysis.themes.modes.find(m => m.name === themeName);
    if (!themeMode) {
      console.log('❌ Theme mode not found:', themeName);
      return false;
    }
    
    // Get the collection
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const themeCollection = collections.find(c => c.name === analysis.themes!.collectionName);
    
    if (!themeCollection) {
      console.log('❌ Theme collection not found:', analysis.themes.collectionName);
      return false;
    }
    
    // Set the current mode (this is a conceptual implementation)
    // In Figma, you would typically use this to update UI or variable references
    console.log('✅ Theme mode set to:', themeName);
    
    // Notify UI about theme change
    figma.ui.postMessage({
      type: 'theme-changed',
      theme: themeName,
      modeId: themeMode.id
    });
    
    return true;
  } catch (error) {
    console.log('❌ Error setting theme mode:', error);
    return false;
  }
}

// ============================================================================
// HTML/CSS INTEGRATION UTILITIES
// ============================================================================

export async function generateCSSCustomProperties(): Promise<string> {
  const analysis = await analyzeAllCollections();
  let css = '/* Auto-generated CSS Custom Properties from Figma Variables */\n\n';
  
  // Generate theme selector classes
  if (analysis.themes) {
    css += '/* Theme Mode Classes */\n';
    for (const mode of analysis.themes.modes) {
      css += `[data-theme="${mode.name}"] {\n`;
      css += `  --figma-theme-mode: "${mode.name}";\n`;
      css += `  --figma-theme-id: "${mode.id}";\n`;
      css += `}\n\n`;
    }
  }
  
  // Generate material selector classes
  if (analysis.materials) {
    css += '/* Material Mode Classes */\n';
    for (const mode of analysis.materials.modes) {
      css += `[data-material="${mode.name}"] {\n`;
      css += `  --figma-material-mode: "${mode.name}";\n`;
      css += `  --figma-material-id: "${mode.id}";\n`;
      css += `}\n\n`;
    }
  }
  
  // Generate appearance selector classes
  if (analysis.appearances) {
    css += '/* Appearance Mode Classes */\n';
    for (const mode of analysis.appearances.modes) {
      css += `[data-appearance="${mode.name}"] {\n`;
      css += `  --figma-appearance-mode: "${mode.name}";\n`;
      css += `  --figma-appearance-id: "${mode.id}";\n`;
      css += `}\n\n`;
    }
  }
  
  return css;
}

export async function generateHTMLModeHelpers(): Promise<string> {
  const analysis = await analyzeAllCollections();
  let html = '<!-- Auto-generated HTML helpers for Figma variable modes -->\n\n';
  
  if (analysis.themes) {
    html += '<!-- Theme Selector -->\n';
    html += '<script>\n';
    html += 'function setFigmaTheme(themeName) {\n';
    html += '  document.documentElement.setAttribute("data-theme", themeName);\n';
    html += '  localStorage.setItem("figma-theme", themeName);\n';
    html += '}\n\n';
    
    html += 'function getFigmaTheme() {\n';
    html += '  return document.documentElement.getAttribute("data-theme") || localStorage.getItem("figma-theme");\n';
    html += '}\n\n';
    
    html += '// Available themes:\n';
    for (const mode of analysis.themes.modes) {
      html += `// setFigmaTheme("${mode.name}");\n`;
    }
    html += '</script>\n\n';
  }
  
  return html;
}

// ============================================================================
// EXPORT MAIN ANALYSIS FUNCTION
// ============================================================================

export async function runCollectionAnalysisCommand() {
  console.log('🚀 Running collection analysis command...');
  
  // Show UI
  figma.showUI(__html__, {
    width: 400,
    height: 600,
    title: 'Collection Analyzer'
  });
  
  // Switch to analyzer feature
  figma.ui.postMessage({
    type: 'switch-feature',
    feature: 'analyze-collections'
  });
  
  // Set up message handler for UI interactions
  figma.ui.onmessage = async (message) => {
    console.log('📨 Received message from UI:', message);
    
    switch (message.type) {
      case 'run-analysis':
        await performAnalysis();
        break;
      case 'set-theme':
        await setThemeMode(message.theme);
        break;
    }
  };
  
  // Run initial analysis
  await performAnalysis();
}

async function performAnalysis() {
  try {
    console.log('🔍 Performing collection analysis...');
    
    const analysis = await analyzeAllCollections();
    const css = await generateCSSCustomProperties();
    const html = await generateHTMLModeHelpers();
    
    // Send results to UI
    figma.ui.postMessage({
      type: 'collection-analysis-complete',
      analysis,
      css,
      html
    });
    
    console.log('✅ Collection analysis complete');
    figma.notify(`✅ Analyzed ${analysis.totalCollections} collections`);
    
  } catch (error) {
    console.log('❌ Error in collection analysis:', error);
    figma.notify('❌ Collection analysis failed');
    
    // Send error to UI
    figma.ui.postMessage({
      type: 'error',
      error: 'Failed to analyze collections: ' + (error as Error).message
    });
  }
}
