// DS Utils Plugin - I18n Export Feature
// Exports variable collections as i18n JavaScript objects with modes as languages

// ============================================================================
// PROGRESS NOTIFICATION HELPER
// ============================================================================

function showProgress(message: string) {
  figma.notify('');
  setTimeout(() => {
    figma.notify(message);
  }, 50);
}

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface I18nExport {
  [language: string]: {
    [key: string]: any; // Can be string or nested object
  };
}

// ============================================================================
// MAIN COMMAND FUNCTION
// ============================================================================

export async function runExportI18nCommand(collectionName: string) {
  console.log('🌍 runExportI18nCommand started');
  console.log('📝 Collection:', collectionName);
  
  showProgress('🌍 Exporting i18n data...');
  
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collection = collections.find(c => c.name === collectionName);
    
    if (!collection) {
      showProgress(`❌ Collection "${collectionName}" not found.`);
      figma.closePlugin();
      return;
    }
    
    console.log('✅ Found collection:', collection.name);
    console.log('📋 Modes:', collection.modes.map(m => m.name));
    
    showProgress(`🔍 Processing variables in "${collectionName}"...`);
    
    const i18nData = await exportCollectionAsI18n(collection);
    
    if (Object.keys(i18nData).length === 0) {
      showProgress('❌ No string variables found in collection.');
      figma.closePlugin();
      return;
    }
    
    // Convert to JavaScript object string
    const jsObjectString = generateJavaScriptObject(i18nData);
    
    // Display the result
    console.log('📋 I18n Export Result:');
    console.log(jsObjectString);
    
    const languageCount = Object.keys(i18nData).length;
    const keyCount = Object.keys(i18nData[Object.keys(i18nData)[0]] || {}).length;
    
    showProgress(`✅ Exported ${keyCount} keys in ${languageCount} languages (check console for output)`);
    
  } catch (error) {
    console.log('❌ Error in runExportI18nCommand:', error);
    showProgress(`❌ Error: ${(error as Error).message}`);
  }
  
  figma.closePlugin();
}

// ============================================================================
// EXPORT LOGIC
// ============================================================================

async function exportCollectionAsI18n(collection: VariableCollection): Promise<I18nExport> {
  const result: I18nExport = {};
  
  // Initialize language objects based on modes
  for (const mode of collection.modes) {
    result[mode.name] = {};
  }
  
  console.log(`🔍 Processing ${collection.variableIds.length} variables...`);
  
  // Process each variable
  for (const variableId of collection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    
    if (variable && variable.resolvedType === 'STRING') {
      const keyPath = convertVariableNameToPath(variable.name);
      
      console.log(`📝 Processing variable: ${variable.name} -> ${keyPath.join('.')}`);
      
      // Get values for each mode (language)
      for (const mode of collection.modes) {
        const value = variable.valuesByMode[mode.modeId];
        
        if (typeof value === 'string') {
          setNestedValue(result[mode.name], keyPath, value);
          console.log(`   ${mode.name}: "${value}"`);
        } else {
          console.log(`   ${mode.name}: [no value or non-string]`);
          setNestedValue(result[mode.name], keyPath, '');
        }
      }
    }
  }
  
  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function convertVariableNameToPath(variableName: string): string[] {
  // Convert variable name to an array of nested keys
  // Examples:
  // "auth/common/submit" -> ["auth", "common", "submit"]
  // "auth/error messages/required field" -> ["auth", "errorMessages", "requiredField"]
  
  return variableName
    .split('/')
    .map(segment => {
      // Convert to camelCase for each segment
      return segment
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+(.)/g, (_, char) => char.toUpperCase()) // camelCase
        .replace(/\s/g, ''); // Remove remaining spaces
    });
}

function setNestedValue(obj: any, path: string[], value: string): void {
  // Create nested object structure and set the value
  // Example: setNestedValue(obj, ["auth", "common", "submit"], "Submit")
  // Creates: obj.auth.common.submit = "Submit"
  
  let current = obj;
  
  // Navigate/create the nested structure
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    
    current = current[key];
  }
  
  // Set the final value
  const finalKey = path[path.length - 1];
  current[finalKey] = value;
}

function generateJavaScriptObject(data: I18nExport): string {
  const lines = ['const i18n = {'];
  
  const languages = Object.keys(data);
  
  for (let i = 0; i < languages.length; i++) {
    const language = languages[i];
    const translations = data[language];
    
    lines.push(`  ${language}: {`);
    
    const objectLines = generateObjectLines(translations, 4);
    objectLines.forEach(line => lines.push(line));
    
    const comma = i < languages.length - 1 ? ',' : '';
    lines.push(`  }${comma}`);
  }
  
  lines.push('};');
  lines.push('');
  lines.push('export default i18n;');
  
  return lines.join('\n');
}

function generateObjectLines(obj: any, indentLevel: number): string[] {
  const lines: string[] = [];
  const indent = ' '.repeat(indentLevel);
  const keys = Object.keys(obj);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = obj[key];
    const comma = i < keys.length - 1 ? ',' : '';
    
    if (typeof value === 'string') {
      // String value - escape quotes and newlines
      const escapedValue = value.replace(/'/g, "\\'").replace(/\n/g, '\\n');
      lines.push(`${indent}${key}: '${escapedValue}'${comma}`);
    } else if (typeof value === 'object' && value !== null) {
      // Nested object
      lines.push(`${indent}${key}: {`);
      const nestedLines = generateObjectLines(value, indentLevel + 2);
      nestedLines.forEach(line => lines.push(line));
      lines.push(`${indent}}${comma}`);
    }
  }
  
  return lines;
}