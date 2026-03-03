// DS Utils Plugin - Main Entry Point
// Handles plugin initialization and command routing

import { runAliasFindReplacePlugin } from './plugin/features/alias-find-replace';
import { runSelectionVariablesPlugin } from './plugin/features/selection-variables';
import { runDuplicateRenamePlugin } from './plugin/features/duplicate-rename';
import { runGenerateDocumentationCommand, runSetFigmaFileLinkCommand, runRemoveDocumentationCommand } from './plugin/features/documentation';
import { runAddColorStopCommand } from './plugin/features/color-stops';
import { runExportI18nCommand } from './plugin/features/i18n-export';
import { runSetDevStatusCommand } from './plugin/features/dev-status';
import { runCollectionAnalysisCommand } from './plugin/features/collection-analyzer';
import { runAddPalettePlugin } from './plugin/features/add-palette';
import { runMapPalettePlugin } from './plugin/features/map-palette';
import { runCopyAliasesPlugin } from './plugin/features/copy-aliases';
import { runCopyModePlugin } from './plugin/features/copy-mode';
import { runMapVariablesPlugin } from './plugin/features/map-variables';

// ============================================================================
// PARAMETER HANDLING
// ============================================================================

// Debouncing to prevent rapid successive calls
const parameterCallTracker = new Map<string, number>();
const DEBOUNCE_DELAY = 300; // milliseconds

// Clean up old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const cutoff = now - (DEBOUNCE_DELAY * 10); // Keep entries for 3 seconds
  for (const [key, timestamp] of parameterCallTracker.entries()) {
    if (timestamp < cutoff) {
      parameterCallTracker.delete(key);
    }
  }
}, 5000); // Clean up every 5 seconds

// Parameter handling for commands
figma.parameters.on('input', ({ parameters, key, query, result }) => {
  console.log('🔧 Parameter input event:', { key, query, parameters });
  
  // Debounce rapid calls to prevent setSuggestions errors
  const callKey = `${key}-${query}`;
  const now = Date.now();
  const lastCall = parameterCallTracker.get(callKey) || 0;
  
  if (now - lastCall < DEBOUNCE_DELAY) {
    console.log('⏱️ Debouncing parameter call for:', callKey);
    return;
  }
  
  parameterCallTracker.set(callKey, now);
  
  if (key === 'collection') {
    handleCollectionInput(query, result);
  } else if (key === 'fileUrl') {
    handleFileUrlInput(query, result);
  } else if (key === 'insertMode') {
    handleInsertModeInput(query, result);
  } else if (key === 'scope') {
    handleScopeInput(query, result);
  } else if (key === 'colorCollection') {
    handleColorCollectionInput(query, result);
  } else if (key === 'colorGroup') {
    handleColorGroupInput(query, result, parameters ? parameters.colorCollection : undefined);
  } else if (key === 'colorValue') {
    handleColorValueInput(query, result);
  } else if (key === 'i18nCollection') {
    handleI18nCollectionInput(query, result);
  } else if (key === 'devStatus') {
    handleDevStatusInput(query, result);
  }
});

export async function handleCollectionInput(query: string, result: ParameterInputEvent['result']) {
  console.log('🔍 handleCollectionInput called with query:', query);
  
  // Get local collections
  console.log('📚 Fetching local collections...');
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  console.log('✅ Local collections found:', localCollections.length);
  localCollections.forEach(c => console.log('  - Local:', c.name));
  
  // Get library collections
  console.log('📚 Fetching library collections...');
  const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  console.log('✅ Library collections found:', libraryCollections.length);
  libraryCollections.forEach(c => console.log('  - Library:', c.name));
  
  // Extract all possible group levels from local collections
  const groups = new Set<string>();
  localCollections.forEach(collection => {
    if (collection.name.includes('/')) {
      // Split the collection name by "/" and create all possible group levels
      const parts = collection.name.split('/');
      for (let i = 1; i < parts.length; i++) {
        const groupName = parts.slice(0, i).join('/');
        if (groupName) {
          groups.add(groupName);
        }
      }
    }
  });
  
  console.log('🌍 Found groups:', Array.from(groups));
  
  // Combine local and library collections, adding "All Collections" option and groups
  const allCollections = [{ name: "All Collections", type: 'all' }];
  Array.from(groups).forEach(g => allCollections.push({ name: g, type: 'group' }));
  localCollections.forEach(c => allCollections.push({ name: c.name, type: 'local' }));
  libraryCollections.forEach(c => allCollections.push({ name: c.name, type: 'library' }));
  
  console.log('🔄 Combined collections and groups:', allCollections.length);
  allCollections.forEach(c => console.log('  -', c.name, `(${c.type})`));
  
  const suggestions = allCollections
    .filter(collection => collection.name.toLowerCase().includes(query.toLowerCase()))
    .map(collection => collection.name);
  
  console.log('💡 Filtered suggestions for query "' + query + '":', suggestions);
  result.setSuggestions(suggestions);
}

export async function handleFileUrlInput(query: string, result: ParameterInputEvent['result']) {
  console.log('🔍 handleFileUrlInput called with query:', query);
  
  // Get the current stored file ID
  const currentFileId = figma.root.getPluginData('figma-file-id');
  
  // Create suggestions based on the query
  const suggestions = [];
  
  // Add the current file ID if it exists and matches the query
  if (currentFileId && currentFileId.toLowerCase().includes(query.toLowerCase())) {
    suggestions.push(`Current: ${currentFileId}`);
  }
  
  // Add common Figma URL patterns as helpful suggestions
  const commonPatterns = [
    'https://www.figma.com/design/',
    'https://www.figma.com/file/',
    'https://figma.com/design/',
    'https://figma.com/file/'
  ];
  
  // Only show patterns if query is empty or very short
  if (query.length <= 5) {
    commonPatterns.forEach(pattern => {
      suggestions.push(pattern);
    });
  }
  
  // If query looks like a file ID, suggest it as a full URL
  if (query.match(/^[a-zA-Z0-9_-]+$/) && query.length > 10) {
    suggestions.push(`https://www.figma.com/design/${query}`);
  }
  
  // Always allow the current query as a suggestion if it's not empty
  if (query.trim() && suggestions.indexOf(query) === -1) {
    suggestions.unshift(query);
  }
  
  console.log('💡 File URL suggestions for query "' + query + '":', suggestions);
  result.setSuggestions(suggestions);
}

export async function handleInsertModeInput(query: string, result: ParameterInputEvent['result']) {
  console.log('🔍 handleInsertModeInput called with query:', query);
  
  // Create suggestions for insert mode
  const suggestions = [
    'Include OS variables',
    'Only this collection'
  ];
  
  // Filter suggestions based on query
  const filteredSuggestions = suggestions.filter(suggestion => 
    suggestion.toLowerCase().includes(query.toLowerCase())
  );
  
  console.log('💡 Insert mode suggestions for query "' + query + '":', filteredSuggestions);
  result.setSuggestions(filteredSuggestions);
}

export async function handleScopeInput(query: string, result: ParameterInputEvent['result']) {
  console.log('🔍 handleScopeInput called with query:', query);
  
  // Create suggestions for scope
  const suggestions = [
    'Current page',
    'All pages'
  ];
  
  // Filter suggestions based on query
  const filteredSuggestions = suggestions.filter(suggestion => 
    suggestion.toLowerCase().includes(query.toLowerCase())
  );
  
  console.log('💡 Scope suggestions for query "' + query + '":', filteredSuggestions);
  result.setSuggestions(filteredSuggestions);
}

export async function handleColorCollectionInput(query: string, result: ParameterInputEvent['result']) {
  console.log('🔍 handleColorCollectionInput called with query:', query);
  
  try {
    // Get local collections with memory safety
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
    console.log('✅ Local collections found:', localCollections.length);
    
    // Filter collections that contain color variables with limits
    const colorCollections = [];
    const maxCollections = 20; // Limit processing
    const limitedCollections = localCollections.slice(0, maxCollections);
    
    for (const collection of limitedCollections) {
      // Limit variable checking to prevent memory issues
      const maxVariables = 10;
      const variableIds = collection.variableIds.slice(0, maxVariables);
      
      for (const variableId of variableIds) {
        try {
          const variable = await figma.variables.getVariableByIdAsync(variableId);
          if (variable && variable.resolvedType === 'COLOR') {
            colorCollections.push(collection.name);
            break; // Found at least one color variable, move to next collection
          }
        } catch (error) {
          console.log('⚠️ Error checking variable:', error);
          continue;
        }
      }
    }
    
    console.log('🎨 Color collections found:', colorCollections);
    
    const suggestions = colorCollections
      .filter(collection => collection.toLowerCase().includes(query.toLowerCase()));
    
    console.log('💡 Filtered color collection suggestions for query "' + query + '":', suggestions);
    result.setSuggestions(suggestions);
  } catch (error) {
    console.log('❌ Error in handleColorCollectionInput:', error);
    result.setSuggestions([]);
  }
}

export async function handleColorGroupInput(query: string, result: ParameterInputEvent['result'], selectedCollection?: string) {
  console.log('🔍 handleColorGroupInput called with query:', query, 'collection:', selectedCollection);
  
  try {
    if (!selectedCollection) {
      result.setSuggestions([]);
      return;
    }
    
    // Get the selected collection with memory safety
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const collection = localCollections.find(c => c.name === selectedCollection);
    
    if (!collection) {
      result.setSuggestions([]);
      return;
    }
    
    // Extract color groups from variables with limits
    const colorGroups = new Set<string>();
    const maxVariables = 100; // Limit processing to prevent memory issues
    const variableIds = collection.variableIds.slice(0, maxVariables);
    
    for (const variableId of variableIds) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (variable && variable.resolvedType === 'COLOR') {
          const segments = variable.name.split("/").filter(Boolean);
          if (segments.length > 1) {
            // Create all possible group levels except the last segment (which is the color stop)
            for (let i = 0; i < segments.length - 1; i++) {
              const groupName = segments.slice(0, i + 1).join("/");
              colorGroups.add(groupName);
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Error processing variable:', error);
        continue;
      }
    }
    
    const suggestions = Array.from(colorGroups)
      .filter(group => group.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 50); // Limit suggestions
    
    console.log('🌈 Color group suggestions for query "' + query + '":', suggestions);
    result.setSuggestions(suggestions);
  } catch (error) {
    console.log('❌ Error in handleColorGroupInput:', error);
    result.setSuggestions([]);
  }
}

export async function handleColorValueInput(query: string, result: ParameterInputEvent['result']) {
  console.log('🔍 handleColorValueInput called with query:', query);
  
  // Create suggestions for color values
  const suggestions: string[] = [];
  
  // Add the current query if it's a valid number
  if (query && /^\d+$/.test(query)) {
    suggestions.push(query);
  }
  
  // Add common color stop suggestions
  const commonStops = ['25', '50', '75', '100', '125', '150', '175', '200', '225', '250', '275', '300', '325', '350', '375', '400', '425', '450', '475', '500', '525', '550', '575', '600', '625', '650', '675', '700', '725', '750', '775', '800', '825', '850', '875', '900', '925', '950', '975'];
  
  // Filter suggestions based on query
  const filteredStops = commonStops.filter(stop => 
    stop.includes(query) || query === ''
  );
  
  // Combine current query and filtered stops
  filteredStops.forEach(stop => {
    if (suggestions.indexOf(stop) === -1) {
      suggestions.push(stop);
    }
  });
  
  console.log('💡 Color value suggestions for query "' + query + '":', suggestions);
  result.setSuggestions(suggestions);
}

export async function handleI18nCollectionInput(query: string, result: ParameterInputEvent['result']) {
  console.log('🔍 handleI18nCollectionInput called with query:', query);
  
  // Get local collections
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  console.log('✅ Local collections found:', localCollections.length);
  
  // Filter collections that contain string variables
  const stringCollections = [];
  for (const collection of localCollections) {
    for (const variableId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (variable && variable.resolvedType === 'STRING') {
        stringCollections.push(collection.name);
        break; // Found at least one string variable, move to next collection
      }
    }
  }
  
  console.log('📝 String collections found:', stringCollections);
  
  const suggestions = stringCollections
    .filter(collection => collection.toLowerCase().includes(query.toLowerCase()));
  
  console.log('💡 Filtered i18n collection suggestions for query "' + query + '":', suggestions);
  result.setSuggestions(suggestions);
}

export async function handleDevStatusInput(query: string, result: ParameterInputEvent['result']) {
  console.log('🔍 handleDevStatusInput called with query:', query);
  
  // Create suggestions for dev status values
  const suggestions = [
    'Ready for Development',
    'Completed',
    'Clear Status'
  ];
  
  // Filter suggestions based on query - if query is empty, show all
  const filteredSuggestions = query.trim() === '' 
    ? suggestions 
    : suggestions.filter(suggestion => 
        suggestion.toLowerCase().includes(query.toLowerCase())
      );
  
  console.log('💡 Dev status suggestions for query "' + query + '":', filteredSuggestions);
  result.setSuggestions(filteredSuggestions);
}

// ============================================================================
// MAIN PLUGIN RUN HANDLER
// ============================================================================

figma.on('run', async ({ command, parameters }) => {
  console.log('🚀 Plugin run event triggered');
  console.log('📋 Command:', command);
  console.log('⚙️ Parameters:', parameters);
  
  switch (command) {
    case 'alias-find-replace':
      console.log('🎯 Running Alias Find & Replace plugin...');
      runAliasFindReplacePlugin();
      break;
    case 'selection-variables':
      console.log('🎯 Running Selection Variables plugin...');
      // Show UI first, then initialize the feature
      if (figma.editorType === "figma") {
        figma.showUI(__html__, {
          width: 420,
          height: 300,
          title: "DS Utils - Selection Variables",
          themeColors: true,
        });
      }
      runSelectionVariablesPlugin();
      break;
    case 'duplicate-rename':
      console.log('🎯 Running Duplicate & Rename plugin...');
      runDuplicateRenamePlugin();
      break;
    case 'generate-documentation':
      console.log('📖 Running Generate Documentation command...');
      if (parameters) {
        console.log('📝 Collection parameter:', parameters.collection);
        console.log('📝 Insert mode parameter:', parameters.insertMode);
        runGenerateDocumentationCommand(parameters.collection, parameters.insertMode);
      } else {
        console.log('❌ No parameters provided for generate-documentation');
        figma.notify('No collection selected. Please try again.');
        figma.closePlugin();
      }
      break;
    case 'set-figma-file-link':
      console.log('🔗 Running Set Figma File Link command...');
      if (parameters) {
        console.log('📝 File URL parameter:', parameters.fileUrl);
        await runSetFigmaFileLinkCommand(parameters.fileUrl);
      } else {
        console.log('❌ No parameters provided for set-figma-file-link');
        figma.notify('No file URL provided. Please try again.');
        figma.closePlugin();
      }
      break;
    case 'remove-documentation':
      console.log('🗑️ Running Remove Documentation command...');
      if (parameters) {
        console.log('📝 Scope parameter:', parameters.scope);
        await runRemoveDocumentationCommand(parameters.scope);
      } else {
        console.log('❌ No parameters provided for remove-documentation');
        figma.notify('No scope provided. Please try again.');
        figma.closePlugin();
      }
      break;
    case 'add-color-stop':
      console.log('🎨 Running Add Color Stop command...');
      if (parameters) {
        console.log('📝 Collection parameter:', parameters.colorCollection);
        console.log('📝 Group parameter:', parameters.colorGroup);
        console.log('📝 Value parameter:', parameters.colorValue);
        await runAddColorStopCommand(parameters.colorCollection, parameters.colorGroup, parameters.colorValue);
      } else {
        console.log('❌ No parameters provided for add-color-stop');
        figma.notify('No parameters provided. Please try again.');
        figma.closePlugin();
      }
      break;
    case 'add-palette':
      console.log('🎨 Running Add Palette plugin...');
      runAddPalettePlugin();
      break;
    case 'map-palette':
      console.log('🎨 Running Map Palette plugin...');
      runMapPalettePlugin();
      break;
    case 'copy-aliases':
      console.log('🔁 Running Copy Aliases plugin...');
      runCopyAliasesPlugin();
      break;
    case 'copy-mode':
      console.log('🧭 Running Copy Mode plugin...');
      runCopyModePlugin();
      break;
    case 'map-variables':
      console.log('🧩 Running Map Variables plugin...');
      runMapVariablesPlugin();
      break;
    case 'export-i18n':
      console.log('🌍 Running Export I18n command...');
      if (parameters) {
        console.log('📝 Collection parameter:', parameters.i18nCollection);
        await runExportI18nCommand(parameters.i18nCollection);
      } else {
        console.log('❌ No parameters provided for export-i18n');
        figma.notify('No collection provided. Please try again.');
        figma.closePlugin();
      }
      break;
    case 'set-dev-status':
      console.log('🚦 Running Set Dev Status command...');
      if (parameters) {
        console.log('📝 Dev status parameter:', parameters.devStatus);
        await runSetDevStatusCommand(parameters.devStatus);
      } else {
        console.log('❌ No parameters provided for set-dev-status');
        figma.notify('No dev status provided. Please try again.');
        figma.closePlugin();
      }
      break;
    case 'analyze-collections':
      console.log('🔍 Running Collection Analysis command...');
      await runCollectionAnalysisCommand();
      break;
    default:
      console.log('❓ Unknown command or no command specified:', command);
      // If no command is specified, run the alias find replace plugin (default behavior)
      if (!command) {
        console.log('🎯 No command specified, running Alias Find & Replace plugin...');
        runAliasFindReplacePlugin();
      } else {
        figma.notify('Unknown command. Please try again.');
        figma.closePlugin();
      }
  }
});
