// DS Utils Plugin - Documentation Generation Feature
// Handles generating documentation frames for variable collections

import { getLocalVariableByName, startsWithPrefix } from '../utils';

// ============================================================================
// PROGRESS NOTIFICATION HELPER
// ============================================================================

// Helper function to clear notifications and show new one
function showProgress(message: string) {
  // Clear any existing notifications by showing a brief empty message
  figma.notify('');
  // Small delay to ensure the clear takes effect
  setTimeout(() => {
    figma.notify(message);
  }, 50);
}

function safeAppendChild(
  parent: BaseNode & ChildrenMixin,
  child: BaseNode & SceneNode,
  context: string
): boolean {
  try {
    parent.appendChild(child);
    return true;
  } catch (error) {
    console.log('❌ appendChild failed', {
      context,
      parent: { id: parent.id, name: safeNodeName(parent), type: parent.type },
      child: { id: child.id, name: safeNodeName(child), type: child.type },
      error,
    });
    return false;
  }
}

function safeNodeName(node: BaseNode): string {
  try {
    return (node as any).name || '';
  } catch (error) {
    return '(unknown)';
  }
}

function getAbsolutePosition(node: SceneNode): { x: number; y: number } {
  const transform = node.absoluteTransform;
  return { x: transform[0][2], y: transform[1][2] };
}

function getOrCreateDocumentationContainer(targetPage: PageNode): FrameNode {
  const containerName = '[DS Utils] Documentation Container';
  const existing = targetPage.findOne(node =>
    node.type === 'FRAME' && node.name === containerName
  ) as FrameNode | null;

  const headerInstance = targetPage.findOne(node =>
    node.type === 'INSTANCE' && node.name === '_doc-header'
  ) as InstanceNode | null;

  const container = existing || figma.createFrame();
  container.name = containerName;
  container.layoutMode = 'VERTICAL';
  container.primaryAxisSizingMode = 'AUTO';
  container.counterAxisSizingMode = 'AUTO';
  container.itemSpacing = 80;
  container.paddingLeft = 0;
  container.paddingRight = 0;
  container.paddingTop = 0;
  container.paddingBottom = 0;
  container.backgrounds = [];

  if (headerInstance) {
    const headerPos = getAbsolutePosition(headerInstance);
    container.x = headerPos.x;
    container.y = headerPos.y + headerInstance.height + 626; // 546 + 80 below header
  } else {
    container.x = 0;
    container.y = 0;
  }

  if (!existing) {
    targetPage.appendChild(container);
  }

  return container;
}
// ============================================================================
// MAIN PLUGIN FUNCTION
// ============================================================================

export async function runSetFigmaFileLinkCommand(fileUrl: string) {
  console.log('🔗 runSetFigmaFileLinkCommand started');
  console.log('📝 File URL:', fileUrl);
  
  // Clear any existing notifications and show initial progress
  showProgress('🔗 Setting Figma file link...');
  
  try {
    const fileId = extractFileIdFromUrl(fileUrl);
    if (fileId) {
      // Store the file ID in plugin data
      figma.root.setPluginData('figma-file-id', fileId);
      console.log('✅ File ID stored:', fileId);
      showProgress(`File ID saved successfully: ${fileId}`);
    } else {
      console.log('❌ Could not extract file ID from URL');
      showProgress('Invalid Figma file URL. Please check the format.');
    }
    
    console.log('🏁 Set Figma File Link completed, closing plugin');
    figma.closePlugin();
  } catch (error) {
    console.log('💥 Error in runSetFigmaFileLinkCommand:', error);
    showProgress(`Error: ${(error as Error).message}`);
    figma.closePlugin();
  }
}

export async function runGenerateDocumentationCommand(collectionName: string, insertMode?: string) {
  console.log('🎬 runGenerateDocumentationCommand started');
  console.log('📝 Collection name:', collectionName);
  
  // Clear any existing notifications and show initial progress
  showProgress('🔄 Initializing documentation generation...');
  
  try {
    // Check if we have a stored file ID
    const storedFileId = figma.root.getPluginData('figma-file-id');
    
    if (!storedFileId) {
      console.log('⚠️ No file ID stored. Use "Set Figma File Link" command first to set up file ID for clickable links.');
      figma.notify('⚠️ No file ID stored. Use "Set Figma File Link" command first for clickable links.');
    } else {
      console.log('✅ Using stored file ID:', storedFileId);
    }
    
    const normalizedInsertMode = insertMode === 'Smart' ? 'Include OS variables' : insertMode;

    if (collectionName === "All Collections") {
      console.log('🌍 Processing ALL collections...');
      showProgress('🔄 Starting documentation generation for all collections...');
      await processAllCollections(normalizedInsertMode);
    } else {
      console.log('🎯 Processing specific collection:', collectionName);
      showProgress(`🔄 Starting documentation generation for: ${collectionName}`);
      await processSpecificCollection(collectionName, normalizedInsertMode);
    }
    
    console.log('🏁 Documentation generation completed, closing plugin');
    showProgress('✅ Documentation generation completed!');
    figma.closePlugin();
  } catch (error) {
    console.log('💥 Error in runGenerateDocumentationCommand:', error);
    figma.notify(`❌ Error: ${(error as Error).message}`);
    figma.closePlugin();
  }
}

// ============================================================================
// COLLECTION PROCESSING
// ============================================================================

async function processAllCollections(insertMode?: string) {
  // Generate documentation for all collections
  console.log('📚 Fetching local collections...');
  showProgress('📚 Fetching collections...');
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  console.log('✅ Local collections found:', localCollections.length);
  
  console.log('📚 Fetching library collections...');
  const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  console.log('✅ Library collections found:', libraryCollections.length);
  
  const totalCollections = localCollections.length + libraryCollections.length;
  console.log(`📊 Total collections to process: ${totalCollections}`);
  showProgress(`📊 Found ${totalCollections} collections to process`);
  
  let totalVariables = 0;
  const allDocumentation: any[] = [];
  let processedCount = 0;
  
  // Process local collections
  console.log('🔄 Processing local collections...');
  let currentX = 100; // Starting X position
  
  for (const collection of localCollections) {
    processedCount++;
    console.log(`📖 Processing local collection ${processedCount}/${totalCollections}:`, collection.name);
    showProgress(`🔄 Processing ${processedCount}/${totalCollections}: ${collection.name}`);
    
    const collectionDoc = await generateDocumentationForCollection(collection, 'local', currentX, insertMode, false);
    if (collectionDoc) {
      allDocumentation.push(collectionDoc);
      totalVariables += collection.variableIds.length;
      // Move to next position (frame width + spacing)
      currentX += collectionDoc.frameWidth + 100; // Using hardcoded 100 for now since SIZES is not accessible here
    }
    console.log('✅ Completed local collection:', collection.name, 'Variables:', collection.variableIds.length);
  }
  
  // Process library collections
  console.log('🔄 Processing library collections...');
  for (const libCollection of libraryCollections) {
    processedCount++;
    console.log(`📖 Processing library collection ${processedCount}/${totalCollections}:`, libCollection.name);
    showProgress(`🔄 Processing ${processedCount}/${totalCollections}: ${libCollection.name}`);
    try {
      const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libCollection.key);
      console.log('📊 Library variables found:', libraryVariables.length);
      
      if (libraryVariables.length > 0) {
        const firstVariable = libraryVariables[0];
        if (firstVariable) {
          console.log('📥 Importing first variable from library...');
          const importedVariable = await figma.variables.importVariableByKeyAsync(firstVariable.key);
          if (importedVariable) {
            console.log('✅ Variable imported successfully');
            const importedCollection = importedVariable.variableCollectionId ? 
              await figma.variables.getVariableCollectionByIdAsync(importedVariable.variableCollectionId) : null;
            if (importedCollection) {
              console.log('📖 Processing imported collection...');
              const collectionDoc = await generateDocumentationForCollection(importedCollection, 'library', currentX, insertMode, false);
              if (collectionDoc) {
                allDocumentation.push(collectionDoc);
                totalVariables += libraryVariables.length;
                // Move to next position (frame width + spacing)
                currentX += collectionDoc.frameWidth + 100; // Using hardcoded 100 for now since SIZES is not accessible here
              }
              console.log('✅ Completed library collection:', libCollection.name, 'Variables:', libraryVariables.length);
            } else {
              console.log('❌ Imported collection has no modes');
            }
          } else {
            console.log('❌ Failed to import variable');
          }
        }
      }
    } catch (e) {
      console.log('❌ Error processing library collection:', libCollection.name, e);
      // Skip library collections that can't be processed
    }
  }
  
  console.log('🎉 All collections processed! Total variables:', totalVariables);
  console.log('📊 Complete documentation object:', JSON.stringify(allDocumentation, null, 2));
  showProgress(`Generated documentation for all collections (${totalVariables} total variables)`);
  
  return allDocumentation;
}

async function processSpecificCollection(collectionName: string, insertMode?: string) {
  console.log('🔍 Processing collection/group:', collectionName);
  
  // Get all local collections first
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();

  if (insertMode === 'Include OS variables') {
    const compMatch = collectionName.match(/comp\/([^/]+)/i);
    if (compMatch && compMatch[1]) {
      const prefix = compMatch[1];
      const osCollection = localCollections.find(c => c.name.toLowerCase() === 'os')
        || localCollections.find(c => c.name.toLowerCase().includes('os'));
      if (!osCollection) {
        figma.notify('OS collection not found. Unable to include OS variables.');
        return null;
      }
      console.log('🧠 Smart mode: using OS collection with prefix:', prefix);
      // Generate documentation for all comp collections that share the selected prefix
      const compPrefix = collectionName.endsWith('/') ? collectionName : `${collectionName}/`;
      const compCollections = localCollections.filter(
        c => c.name === collectionName || c.name.toLowerCase() === collectionName.toLowerCase() || c.name.startsWith(compPrefix)
      );
      let currentX: number | undefined = undefined;
      if (compCollections.length === 0) {
        figma.notify(`No collections found for: ${collectionName}`);
        return null;
      }

      for (const compCollection of compCollections) {
        const compDoc = await generateDocumentationForCollection(
          compCollection,
          'local',
          currentX,
          insertMode,
          false
        );
        if (compDoc) {
          currentX = (currentX ?? 100) + compDoc.frameWidth + 100;
        }
      }

      // Generate documentation for OS variables filtered by prefix
      const collectionDoc = await generateDocumentationForCollection(
        osCollection,
        'local',
        currentX,
        insertMode,
        false,
        { displayName: `OS / ${prefix}`, variablePrefix: prefix }
      );
      showProgress(`Generated documentation for: ${collectionName}`);
      return collectionDoc;
    }
  }
  
  // First, try to find an exact collection match
  let collection = localCollections.find(c => c.name === collectionName);
  
  if (collection) {
    console.log('✅ Found exact collection match:', collectionName);
    const collectionDoc = await generateDocumentationForCollection(collection, 'local', undefined, insertMode, false);
    console.log('📊 Collection documentation:', JSON.stringify(collectionDoc, null, 2));
    showProgress(`Generated documentation for collection: ${collectionName}`);
    return collectionDoc;
  }
  
  // If no exact match, check if it's a group (has collections starting with this name + "/")
  const matchingCollections = localCollections.filter(c => c.name.startsWith(collectionName + '/'));
  
  if (matchingCollections.length > 0) {
    console.log(`🌍 Found ${matchingCollections.length} collections starting with "${collectionName}/" - treating as group`);
    return await processGroupCollections(collectionName, insertMode);
  }
  
  // If still no match, check if it's a group with trailing slash
  if (collectionName.endsWith('/')) {
    const groupName = collectionName.slice(0, -1); // Remove trailing slash
    const groupMatchingCollections = localCollections.filter(c => c.name.startsWith(groupName + '/'));
    
    if (groupMatchingCollections.length > 0) {
      console.log(`🌍 Found ${groupMatchingCollections.length} collections starting with "${groupName}/" - treating as group`);
      return await processGroupCollections(groupName);
    }
  }
  
  if (collection) {
    console.log('✅ Found in local collections');
    const collectionDoc = await generateDocumentationForCollection(collection, 'local');
    console.log('📊 Collection documentation:', JSON.stringify(collectionDoc, null, 2));
    figma.notify(`Generated documentation for collection: ${collectionName}`);
    return collectionDoc;
  } else {
    console.log('❌ Not found in local collections, trying library collections...');
    // Try library collections
    const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    const libraryCollection = libraryCollections.find(c => c.name === collectionName);
    
    if (libraryCollection) {
      console.log('✅ Found in library collections');
      try {
        const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libraryCollection.key);
        console.log('📊 Library variables found:', libraryVariables.length);
        
        if (libraryVariables.length > 0) {
          const firstVariable = libraryVariables[0];
          if (firstVariable) {
            console.log('📥 Importing variable from library...');
            const importedVariable = await figma.variables.importVariableByKeyAsync(firstVariable.key);
            if (importedVariable) {
              console.log('✅ Variable imported successfully');
              const importedCollection = importedVariable.variableCollectionId ? 
                await figma.variables.getVariableCollectionByIdAsync(importedVariable.variableCollectionId) : null;
              if (importedCollection) {
                console.log('📖 Processing imported collection...');
                const collectionDoc = await generateDocumentationForCollection(importedCollection, 'library');
                console.log('📊 Collection documentation:', JSON.stringify(collectionDoc, null, 2));
                figma.notify(`Generated documentation for library collection: ${collectionName}`);
                return collectionDoc;
              } else {
                console.log('❌ Imported collection has no modes');
                figma.notify(`Could not access library collection: ${collectionName}`);
              }
            } else {
              console.log('❌ Failed to import variable');
            }
          }
        }
      } catch (e) {
        console.log('❌ Error accessing library collection:', e);
        figma.notify(`Error accessing library collection: ${collectionName}`);
      }
    } else {
      console.log('❌ Collection not found anywhere');
      figma.notify(`Collection not found: ${collectionName}`);
    }
  }
  
  return null;
}

// ============================================================================
// GROUP COLLECTION PROCESSING
// ============================================================================

async function processGroupCollections(groupName: string, insertMode?: string) {
  console.log('🌍 Processing group:', groupName);
  figma.notify(`🔄 Processing group: ${groupName}`);
  
  // Get all local collections
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  
  // Find all collections that start with the group name
  // Handle both cases: "1 semantic" and "1 semantic/"
  const groupPrefix = groupName.endsWith('/') ? groupName : groupName + '/';
  const matchingCollections = localCollections.filter(c => c.name.startsWith(groupPrefix));
  
  console.log(`📊 Found ${matchingCollections.length} collections in group "${groupName}":`);
  matchingCollections.forEach(c => console.log(`  - ${c.name}`));
  
  if (matchingCollections.length === 0) {
    showProgress(`No collections found in group: ${groupName}`);
    return null;
  }
  
  showProgress(`📊 Found ${matchingCollections.length} collections in group: ${groupName}`);
  
  // Create wrapper frame for multiple collections
  const wrapperFrame = figma.createFrame();
  wrapperFrame.name = `[DS Utils] Documentation - ${groupName}`;
  wrapperFrame.layoutMode = 'HORIZONTAL';
  wrapperFrame.primaryAxisSizingMode = 'AUTO';
  wrapperFrame.counterAxisSizingMode = 'AUTO';
  wrapperFrame.paddingLeft = 0;
  wrapperFrame.paddingRight = 0;
  wrapperFrame.paddingTop = 0;
  wrapperFrame.paddingBottom = 0;
  wrapperFrame.itemSpacing = 100; // 100px spacing
  wrapperFrame.backgrounds = []; // Make background transparent
  
  // Process each collection in the group
  const groupDocumentation: any[] = [];
  
  for (let i = 0; i < matchingCollections.length; i++) {
    const collection = matchingCollections[i];
    console.log(`📖 Processing collection ${i + 1}/${matchingCollections.length} in group: ${collection.name}`);
    showProgress(`🔄 Processing ${i + 1}/${matchingCollections.length}: ${collection.name}`);
    
    const collectionDoc = await generateDocumentationForCollection(collection, 'local', undefined, insertMode, true); // true = isWrapperChild
    if (collectionDoc) {
      groupDocumentation.push(collectionDoc);
      // Add the frame to the wrapper
      if (collectionDoc.frame) {
        wrapperFrame.appendChild(collectionDoc.frame);
        console.log(`✅ Added frame "${collectionDoc.frame.name}" to wrapper`);
      } else {
        console.log('⚠️ Frame not available in collectionDoc');
      }
    }
  }
  
  // Position the wrapper frame
  let targetPage: PageNode;
  
  targetPage = figma.currentPage;
  console.log(`🎯 Using current page for wrapper: "${targetPage.name}"`);
  
  // Ensure the target page is loaded before appending
  try {
    await targetPage.loadAsync();
    console.log(`✅ Target page "${targetPage.name}" loaded successfully`);
  } catch (error) {
    console.log(`❌ Error loading target page: ${error}`);
    // Fallback to current page if loading fails
    targetPage = figma.currentPage;
    console.log(`🔄 Falling back to current page: "${targetPage.name}"`);
  }
  
  // Move the wrapper frame to the container on the target page
  const container = getOrCreateDocumentationContainer(targetPage);
  safeAppendChild(container, wrapperFrame, 'container.appendChild(wrapperFrame)');
  
  // Let the container auto-layout handle positioning
  wrapperFrame.x = 0;
  wrapperFrame.y = 0;
  
  console.log(`✅ Group processing completed. Generated ${groupDocumentation.length} documentation frames in wrapper.`);
  showProgress(`Generated documentation for ${groupDocumentation.length} collections in group: ${groupName}`);
  
  return groupDocumentation;
}




// ============================================================================
// DOCUMENTATION FRAME MANAGEMENT
// ============================================================================

function deleteExistingDocumentationFrames(targetPage: PageNode): number {
  console.log('🗑️ Deleting existing documentation wrapper frames...');
  
  // Find all existing documentation frames on the target page (main wrappers only)
  const existingWrapperFrames = targetPage.findAll(node => 
    node.type === 'FRAME' && 
    node.name.includes('[DS Utils] Documentation -') &&
    !node.name.includes('Wrapper')
  ) as FrameNode[];

  console.log('🔍 Existing wrapper frames:', existingWrapperFrames);
  
  if (existingWrapperFrames.length === 0) {
    console.log('🔍 No existing documentation wrapper frames found');
    return 0;
  }
  
  console.log(`📊 Found ${existingWrapperFrames.length} existing documentation wrapper frames to delete`);
  
  // Delete each wrapper frame (this will also delete all child frames)
  for (const wrapperFrame of existingWrapperFrames) {
    console.log(`🗑️ Deleting wrapper frame: "${wrapperFrame.name}"`);
    wrapperFrame.remove();
  }
  
  console.log('✅ Existing documentation wrapper frames deleted');
  return existingWrapperFrames.length;
}

function deleteDocumentationWrapperByName(
  targetPage: PageNode,
  wrapperName: string,
  excludeId?: string
): boolean {
  const existing = targetPage.findAll(node =>
    node.type === 'FRAME' &&
    node.name === wrapperName &&
    (!excludeId || node.id !== excludeId)
  ) as FrameNode[];
  if (existing.length === 0) return false;
  for (const frame of existing) {
    frame.remove();
  }
  return true;
}

// ============================================================================
// SMART PAGE FINDING
// ============================================================================

function findSmartPageForCollection(collectionName: string): PageNode | null {
  console.log('🔍 Finding smart page for collection:', collectionName);
  
  // Get all pages in the document
  const pages = figma.root.children;
  console.log('📄 Available pages:', pages.map(p => p.name));
  
  // Extract key words from collection name
  const collectionWords = collectionName.toLowerCase().split('/').filter(word => word.length > 0);
  console.log('🔤 Collection words:', collectionWords);
  
  // Score each page based on word matches
  let bestPage: PageNode | null = null;
  let bestScore = 0;
  
  for (const page of pages) {
    const pageName = page.name.toLowerCase();
    let score = 0;
    
    // Check for exact page name match (highest priority)
    if (pageName === collectionName.toLowerCase()) {
      score += 10; // Very high score for exact page name match
      console.log(`🎯 Exact page name match found: "${page.name}"`);
    }
    
    // Check for page name starts with collection name
    if (pageName.startsWith(collectionName.toLowerCase())) {
      score += 8; // High score for page name starting with collection name
      console.log(`🎯 Page name starts with collection: "${page.name}"`);
    }
    
    // Check for exact word matches
    for (const word of collectionWords) {
      if (pageName.includes(word)) {
        score += 3; // Good score for exact word matches
      }
    }
    
    // Check for partial matches (e.g., "semantic" in "variables (base & semantic)")
    for (const word of collectionWords) {
      if (word.length > 3 && pageName.includes(word.substring(0, word.length - 1))) {
        score += 1; // Lower score for partial matches
      }
    }
    
    // Special cases for common patterns (lower priority)
    if (collectionName.includes('semantic') && pageName.includes('semantic')) {
      score += 2;
    }
    if (collectionName.includes('base') && pageName.includes('base')) {
      score += 2;
    }
    if (collectionName.includes('button') && pageName.includes('button')) {
      score += 2;
    }
    
    console.log(`📊 Page "${page.name}" score: ${score}`);
    
    if (score > bestScore) {
      bestScore = score;
      bestPage = page;
    }
  }
  
  if (bestPage && bestScore > 0) {
    console.log(`✅ Found best page: "${bestPage.name}" with score: ${bestScore}`);
    return bestPage;
  } else {
    console.log('❌ No suitable page found, will use current page');
    return null;
  }
}

// ============================================================================
// URL EXTRACTION
// ============================================================================

function extractFileIdFromUrl(url: string): string | null {
  try {
    // Extract file ID from Figma URL
    // Format: https://www.figma.com/design/FILE_ID/...
    const match = url.match(/figma\.com\/design\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Also try the shorter format: https://www.figma.com/file/FILE_ID/...
    const fileMatch = url.match(/figma\.com\/file\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && fileMatch[1]) {
      return fileMatch[1];
    }
    
    return null;
  } catch (error) {
    console.log('❌ Error extracting file ID from URL:', error);
    return null;
  }
}

// ============================================================================
// URL CONSTRUCTION
// ============================================================================

function constructVariableUrl(variableId: string): string {
  // Use plugin data stored on the document node to get the file ID
  // This is more reliable than clientStorage and persists with the document
  
  try {
    // Try to get the stored file ID from document plugin data
    const storedFileId = figma.root.getPluginData('figma-file-id');
    
    if (storedFileId) {
      const baseUrl = `https://www.figma.com/design/${storedFileId}`;
      const url = `${baseUrl}?vars=1&var-id=${variableId.replace("VariableID:", "")}&m=dev`;
      console.log(`🔗 Constructed URL for variable ${variableId}: ${url}`);
      return url;
    } else {
      // Fallback to a placeholder URL
      const baseUrl = 'https://www.figma.com/design/YOUR_FILE_ID_HERE';
      const url = `${baseUrl}?vars=1&var-id=${variableId.replace("VariableID:", "")}&m=dev`;
      console.log(`🔗 Constructed URL for variable ${variableId}: ${url}`);
      console.log('💡 To fix URLs, run: figma.root.setPluginData("figma-file-id", "your-actual-file-id")');
      return url;
    }
  } catch (error) {
    console.log('⚠️ Error getting file ID from plugin data:', error);
    // Fallback to a generic URL
    return `https://www.figma.com/?vars=1&var-id=${variableId.replace("VariableID:", "")}&m=dev`;
  }
}

// ============================================================================
// DOCUMENTATION GENERATION
// ============================================================================

type DocumentationOptions = { displayName?: string; variablePrefix?: string };

async function generateDocumentationForCollection(
  collection: VariableCollection,
  type: 'local' | 'library',
  xPosition?: number,
  insertMode?: string,
  isWrapperChild?: boolean,
  options?: DocumentationOptions
): Promise<{ name: string; type: string; variableCount: number; frameId: string; frameWidth: number; frame?: FrameNode } | null> {
  console.log('📖 generateDocumentationForCollection started');
  console.log('📋 Collection:', collection.name, 'Type:', type);
  const displayName = options?.displayName || collection.name;
  
  // Show progress for this collection
  if (!isWrapperChild) {
    showProgress(`🔄 Generating documentation for: ${collection.name}`);
  }
  
  // ============================================================================
  // SIZING CONFIGURATION - Edit these values to adjust layout
  // ============================================================================
  const SIZES = {
    // Main frame settings
    mainFramePaddingX: 40,
    mainFramePaddingY: 0,
    mainFrameItemSpacing: 0,
    
    // Cell widths
    variableTypeWidth: 40,
    variableNameWidth: 360,
    variableValueWidth: 240,
    
    // Positioning
    defaultX: 100,
    defaultY: 100,
    frameSpacing: 100 // Used when processing all collections
  };
  
  // Get components by their specific IDs with error handling
  let headerComponent: ComponentNode | null = null;
  let colHeaderComponent: ComponentNode | null = null;
  let variableNameComponent: ComponentNode | null = null;
  let variableTypeComponent: ComponentSetNode | null = null;
  let variableValueComponent: ComponentSetNode | null = null;
  let footerComponent: ComponentNode | null = null;
  
  try {
    headerComponent = await figma.getNodeByIdAsync('795:10077') as ComponentNode | null;
  } catch (error) {
    console.log('❌ Error getting header component:', error);
  }
  
  try {
    colHeaderComponent = await figma.getNodeByIdAsync('795:10044') as ComponentNode | null;
  } catch (error) {
    console.log('❌ Error getting col header component:', error);
  }
  
  try {
    variableNameComponent = await figma.getNodeByIdAsync('795:10048') as ComponentNode | null;
  } catch (error) {
    console.log('❌ Error getting variable name component:', error);
  }
  
  try {
    variableTypeComponent = await figma.getNodeByIdAsync('795:10055') as ComponentSetNode | null;
  } catch (error) {
    console.log('❌ Error getting variable type component:', error);
  }
  
  try {
    variableValueComponent = await figma.getNodeByIdAsync('796:87958') as ComponentSetNode | null;
  } catch (error) {
    console.log('❌ Error getting variable value component:', error);
  }
  
  try {
    footerComponent = await figma.getNodeByIdAsync('797:92005') as ComponentNode | null;
  } catch (error) {
    console.log('❌ Error getting footer component:', error);
  }
  
  // Check if all required components are found
  if (!headerComponent || !colHeaderComponent || !variableNameComponent || !variableTypeComponent || !variableValueComponent || !footerComponent) {
    console.log('❌ Required components not found');
    const missing = [];
    if (!headerComponent) missing.push('header');
    if (!colHeaderComponent) missing.push('col header');
    if (!variableNameComponent) missing.push('row/variable name');
    if (!variableTypeComponent) missing.push('row/variable type');
    if (!variableValueComponent) missing.push('row/variable value');
    if (!footerComponent) missing.push('footer');
    
    showProgress(`Error: Missing components: ${missing.join(', ')}`);
    return null;
  }
  
  // Log all component properties to understand what's available
  try {
    console.log('🔍 Component Properties Analysis:');
    
    if (headerComponent) {
      console.log('📋 Header Component Properties:');
      console.log('  - Name:', safeNodeName(headerComponent));
      console.log('  - Type:', headerComponent.type);
      console.log('  - Component Property Definitions:', Object.keys(headerComponent.componentPropertyDefinitions || {}));
      console.log('  - Component Property Definitions Details:', headerComponent.componentPropertyDefinitions);
    }
    
    if (colHeaderComponent) {
      console.log('📋 Column Header Component Properties:');
      console.log('  - Name:', safeNodeName(colHeaderComponent));
      console.log('  - Type:', colHeaderComponent.type);
      console.log('  - Component Property Definitions:', Object.keys(colHeaderComponent.componentPropertyDefinitions || {}));
      console.log('  - Component Property Definitions Details:', colHeaderComponent.componentPropertyDefinitions);
    }
    
    if (variableNameComponent) {
      console.log('📋 Variable Name Component Properties:');
      console.log('  - Name:', safeNodeName(variableNameComponent));
      console.log('  - Type:', variableNameComponent.type);
      console.log('  - Component Property Definitions:', Object.keys(variableNameComponent.componentPropertyDefinitions || {}));
      console.log('  - Component Property Definitions Details:', variableNameComponent.componentPropertyDefinitions);
    }
    
    if (variableTypeComponent) {
      console.log('📋 Variable Type Component Set Properties:');
      console.log('  - Name:', safeNodeName(variableTypeComponent));
      console.log('  - Type:', variableTypeComponent.type);
      console.log('  - Component Property Definitions:', Object.keys(variableTypeComponent.componentPropertyDefinitions || {}));
      console.log('  - Component Property Definitions Details:', variableTypeComponent.componentPropertyDefinitions);
      console.log('  - Variants:', variableTypeComponent.children.map(child => ({
        name: safeNodeName(child),
        type: child.type
      })));
    }
    
    if (variableValueComponent) {
      console.log('📋 Variable Value Component Properties:');
      console.log('  - Name:', safeNodeName(variableValueComponent));
      console.log('  - Type:', variableValueComponent.type);
      console.log('  - Component Property Definitions:', Object.keys(variableValueComponent.componentPropertyDefinitions || {}));
      console.log('  - Component Property Definitions Details:', variableValueComponent.componentPropertyDefinitions);
    }
  } catch (error) {
    console.log('⚠️ Skipping component property analysis due to error:', error);
  }
  
  // Create the main documentation frame
  const docFrame = figma.createFrame();
  docFrame.name = `[DS Utils] Documentation - ${displayName}`;
  docFrame.layoutMode = 'VERTICAL';
  docFrame.primaryAxisSizingMode = 'AUTO';
  docFrame.counterAxisSizingMode = 'AUTO';
  docFrame.paddingLeft = SIZES.mainFramePaddingX;
  docFrame.paddingRight = SIZES.mainFramePaddingX;
  docFrame.paddingTop = SIZES.mainFramePaddingY;
  docFrame.paddingBottom = SIZES.mainFramePaddingY;
  docFrame.itemSpacing = SIZES.mainFrameItemSpacing;
  
  // Ensure auto-layout is properly configured
  docFrame.layoutGrow = 0;
  docFrame.layoutAlign = 'INHERIT';
  
  // Apply background variable
  try {
    const bgVariable = await getLocalVariableByName('colors/bg-primary');
    if (bgVariable) {
      const fills = docFrame.fills;
      if (Array.isArray(fills) && fills.length > 0) {
        const firstFill = fills[0];
        if (firstFill.type === 'SOLID') {
          const boundPaint = figma.variables.setBoundVariableForPaint(firstFill, 'color', bgVariable);
          docFrame.fills = [boundPaint];
          console.log('✅ Background variable applied to main frame');
        }
      }
    } else {
      console.log('⚠️ Background variable "color/bg/bg" not found');
    }
  } catch (error) {
    console.log('❌ Error applying background variable:', error);
  }
  
  // Generate current date
  const today = new Date();
  const day = today.getDate().toString();
  const month = (today.getMonth() + 1).toString();
  const year = today.getFullYear().toString();
  const dateString = `${day.length === 1 ? '0' + day : day}/${month.length === 1 ? '0' + month : month}/${year}`;
  
  // Create header
  const headerInstance = headerComponent.createInstance();
  // Get the actual property names from the component
  const headerProps = Object.keys(headerComponent.componentPropertyDefinitions || {});
  console.log('🔧 Setting header properties:', headerProps);
  
  // Try to set properties using the actual names from componentPropertyDefinitions
  const headerProperties: any = {};
  if (headerProps.indexOf('title') !== -1) {
    headerProperties.title = displayName;
  } else {
    const titleProp = headerProps.find(prop => prop.indexOf('title') !== -1);
    if (titleProp) {
      headerProperties[titleProp] = displayName;
    }
  }
  
  if (headerProps.indexOf('date') !== -1) {
    headerProperties.date = dateString;
  } else {
    const dateProp = headerProps.find(prop => prop.indexOf('date') !== -1);
    if (dateProp) {
      headerProperties[dateProp] = dateString;
    }
  }
  
  console.log('🔧 Header properties to set:', headerProperties);
  headerInstance.setProperties(headerProperties);
  
  docFrame.appendChild(headerInstance);
  
  // Set header to fill the width after adding to auto-layout frame
  headerInstance.layoutSizingHorizontal = 'FILL';
  
  // Create a single table with modes as columns
  console.log(`📋 Creating table with ${collection.modes.length} modes`);
  
  // Create table header row
  const headerRow = figma.createFrame();
  headerRow.name = 'Table Header';
  headerRow.layoutMode = 'HORIZONTAL';
  headerRow.primaryAxisSizingMode = 'AUTO';
  headerRow.counterAxisSizingMode = 'AUTO';
  headerRow.paddingLeft = 0;
  headerRow.paddingRight = 0;
  headerRow.paddingTop = 0;
  headerRow.paddingBottom = 0;
  headerRow.itemSpacing = 0;
  headerRow.backgrounds = []; // Make background transparent
  
  // Create header cells: Variable Type, Variable Name, then each mode
  const typeHeader = colHeaderComponent.createInstance();
  const colHeaderProps = Object.keys(colHeaderComponent.componentPropertyDefinitions || {});
  const colProp = colHeaderProps.find(prop => prop.indexOf('col') !== -1) || 'col';
  typeHeader.setProperties({ [colProp]: 'Variable Type' });
  typeHeader.layoutSizingHorizontal = 'FIXED';
  typeHeader.resize(SIZES.variableTypeWidth, typeHeader.height);
  headerRow.appendChild(typeHeader);
  
  const nameHeader = colHeaderComponent.createInstance();
  nameHeader.setProperties({ [colProp]: 'Variable Name' });
  nameHeader.layoutSizingHorizontal = 'FIXED';
  nameHeader.resize(SIZES.variableNameWidth, nameHeader.height);
  headerRow.appendChild(nameHeader);
  
  // Add header for each mode
  for (const mode of collection.modes) {
    const modeHeader = colHeaderComponent.createInstance();
    modeHeader.setProperties({ [colProp]: mode.name });
    modeHeader.layoutSizingHorizontal = 'FIXED';
    modeHeader.resize(SIZES.variableValueWidth, modeHeader.height);
    headerRow.appendChild(modeHeader);
  }
  
  docFrame.appendChild(headerRow);
  
  // Get all variables and their values for all modes
  const allVariables = [];
  console.log(`📊 Processing ${collection.variableIds.length} variables...`);
  
  for (let i = 0; i < collection.variableIds.length; i++) {
    const variableId = collection.variableIds[i];
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) continue;
    if (options?.variablePrefix && !startsWithPrefix(variable.name, options.variablePrefix)) {
      continue;
    }
    
    const variableData = {
      variable,
      modeValues: new Map()
    };
    
    // Get values for each mode
    for (const mode of collection.modes) {
      const value = variable.valuesByMode[mode.modeId];
      if (value !== undefined && value !== null) {
        variableData.modeValues.set(mode.modeId, value);
      }
    }
    
    // Only include variables that have values in at least one mode
    if (variableData.modeValues.size > 0) {
      allVariables.push(variableData);
    }
  }
  
      // Create table rows for each variable
    console.log(`📋 Creating table rows for ${allVariables.length} variables...`);
    for (let i = 0; i < allVariables.length; i++) {
      const { variable, modeValues } = allVariables[i];
      const row = figma.createFrame();
      row.name = `Row: ${variable.name}`;
      row.layoutMode = 'HORIZONTAL';
      row.primaryAxisSizingMode = 'AUTO';
      row.counterAxisSizingMode = 'AUTO';
      row.paddingLeft = 0;
      row.paddingRight = 0;
      row.paddingTop = 0;
      row.paddingBottom = 0;
      row.itemSpacing = 0;
      row.backgrounds = []; // Make background transparent
    
    // Variable Type cell (empty text)
    const typeInstance = variableTypeComponent.defaultVariant.createInstance();
    
    // Clear any text content in the type cell
    try {
      const textNodes = typeInstance.findAll(node => node.type === 'TEXT') as TextNode[];
      for (const textNode of textNodes) {
        textNode.characters = '';
      }
    } catch (error) {
      console.log('⚠️ Could not clear text in variable type cell:', error);
    }
    
    typeInstance.layoutSizingHorizontal = 'FIXED';
    typeInstance.resize(SIZES.variableTypeWidth, typeInstance.height);
    row.appendChild(typeInstance);
    
    // Variable Name cell
    const nameInstance = variableNameComponent.createInstance();
    const nameProps = Object.keys(variableNameComponent.componentPropertyDefinitions || {});
    const nameProp = nameProps.find(prop => prop.indexOf('name') !== -1) || 'name';
    nameInstance.setProperties({ [nameProp]: variable.name });
    
    // Add hyperlink to the variable name
    try {
      // Find the text node within the name instance that contains the variable name
      const textNodes = nameInstance.findAll(node => node.type === 'TEXT') as TextNode[];
      
      for (const textNode of textNodes) {
        if (textNode.characters.includes(variable.name)) {
          // Construct the Figma URL for this variable
          const figmaUrl = constructVariableUrl(variable.id);
          
          // Find the position of the variable name in the text
          const nameIndex = textNode.characters.indexOf(variable.name);
          if (nameIndex !== -1) {
            const startIndex = nameIndex;
            const endIndex = nameIndex + variable.name.length;
            
            // Add the hyperlink
            textNode.setRangeHyperlink(startIndex, endIndex, { type: 'URL', value: figmaUrl });
            console.log(`🔗 Added hyperlink to variable "${variable.name}": ${figmaUrl}`);
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not add hyperlink to variable name:', error);
    }
    
    nameInstance.layoutSizingHorizontal = 'FIXED';
    nameInstance.resize(SIZES.variableNameWidth, nameInstance.height);
    row.appendChild(nameInstance);
    
    // Variable Value cells for each mode
    for (const mode of collection.modes) {
      const value = modeValues.get(mode.modeId);
      const valueInstance = variableValueComponent.defaultVariant.createInstance();
      try {
        valueInstance.setExplicitVariableModeForCollection(collection, mode.modeId);
      } catch (error) {
        console.log('⚠️ Could not set explicit variable mode for value instance:', error);
      }
      
      // Get the component properties to find the type property (same approach as variable type)
      const valueProps = Object.keys(variableValueComponent.componentPropertyDefinitions || {});
      console.log('🔧 Variable Value Component Properties:', valueProps);
      
      // Set the type property to switch to the correct variant based on variable type
      const variableType = variable.resolvedType;
      const typeProperty = valueProps.find(prop => 
        prop.toLowerCase().includes('type') || 
        prop.toLowerCase().includes('variant')
      );
      
      if (typeProperty) {
        // Set the property to switch to the correct variant
        valueInstance.setProperties({ [typeProperty]: variableType });
        console.log('✅ Set variable value type property:', typeProperty, 'to:', variableType);
      } else {
        console.log('⚠️ No type property found in variable value component, using default variant');
      }
      
      // Find the actual property names - only set properties that exist
      const propertiesToSet: any = {};
      let aliasVarToLink: Variable | null = null;
      
      const showAliasProp = valueProps.find(prop => prop.indexOf('show alias') !== -1);
      const aliasProp = valueProps.find(prop => prop.indexOf('alias') !== -1);
      const showRawProp = valueProps.find(prop => prop.indexOf('show raw') !== -1);
      const rawProp = valueProps.find(prop => prop.indexOf('raw') !== -1);
      const valueProp = valueProps.find(prop => prop.indexOf('value') !== -1);
      
      if (value !== undefined && value !== null) {
        console.log('🔍 Processing value:', value, 'Type:', typeof value, 'Variable type:', variable.resolvedType);
        
        if (typeof value === 'object' && (value as any).type === 'VARIABLE_ALIAS') {
          // Handle alias
          const aliasId = (value as any).id;
          const aliasVar = await figma.variables.getVariableByIdAsync(aliasId);
          aliasVarToLink = aliasVar || null;
          
          if (showAliasProp) propertiesToSet[showAliasProp] = true;
          if (aliasProp) propertiesToSet[aliasProp] = aliasVar ? aliasVar.name : 'Unknown';
          if (showRawProp) propertiesToSet[showRawProp] = false;
          if (rawProp) propertiesToSet[rawProp] = '';
          if (valueProp) propertiesToSet[valueProp] = 'alias';
          
        } else {
          // Handle direct value - convert to appropriate format based on type
          let rawValue = '';
          switch (variable.resolvedType) {
            case 'COLOR':
              if (typeof value === 'object') {
                // Convert color to hex with opacity support
                const color = value as RGB | RGBA;
                const r = Math.round(color.r * 255);
                const g = Math.round(color.g * 255);
                const b = Math.round(color.b * 255);
                const rHex = r.toString(16);
                const gHex = g.toString(16);
                const bHex = b.toString(16);
                
                // Check if it's RGBA (has alpha channel)
                if ('a' in color && color.a !== undefined && color.a < 1) {
                  // Only add alpha if it's not 100% opaque
                  const a = Math.round(color.a * 255);
                  const aHex = a.toString(16);
                  rawValue = `#${rHex.length === 1 ? '0' + rHex : rHex}${gHex.length === 1 ? '0' + gHex : gHex}${bHex.length === 1 ? '0' + bHex : bHex}${aHex.length === 1 ? '0' + aHex : aHex}`;
                } else {
                  // RGB only (or 100% opaque)
                  rawValue = `#${rHex.length === 1 ? '0' + rHex : rHex}${gHex.length === 1 ? '0' + gHex : gHex}${bHex.length === 1 ? '0' + bHex : bHex}`;
                }
              }
              break;
            case 'STRING':
            case 'FLOAT':
              rawValue = String(value);
              break;
            default:
              // Handle boolean and other types
              if (typeof value === 'string') {
                rawValue = value ? 'true' : 'false';
              } else {
                rawValue = String(value);
              }
              console.log('🔍 Default case - rawValue set to:', rawValue);
              break;
          }
          
          console.log('🔍 Final rawValue:', rawValue);
          
          if (showAliasProp) propertiesToSet[showAliasProp] = false;
          if (aliasProp) propertiesToSet[aliasProp] = '';
          if (showRawProp) propertiesToSet[showRawProp] = true;
          if (rawProp) {
            // For boolean variables, if rawValue is empty, default to "false"
            if (variable.resolvedType === 'BOOLEAN' && (!rawValue || rawValue === '')) {
              propertiesToSet[rawProp] = 'false';
            } else {
              propertiesToSet[rawProp] = rawValue;
            }
          }
          if (valueProp) propertiesToSet[valueProp] = 'raw';
        }
              } else {
          // No value for this mode - show empty
          if (showAliasProp) propertiesToSet[showAliasProp] = false;
          if (aliasProp) propertiesToSet[aliasProp] = '';
          if (showRawProp) propertiesToSet[showRawProp] = false;
          if (rawProp) propertiesToSet[rawProp] = '';
          if (valueProp) propertiesToSet[valueProp] = 'raw'; // Default to raw for empty values
        }
      
        console.log('🔧 Setting variable value properties:', propertiesToSet);
        console.log('🔧 Properties found - showAliasProp:', showAliasProp, 'aliasProp:', aliasProp, 'showRawProp:', showRawProp, 'rawProp:', rawProp);
        if (Object.keys(propertiesToSet).length > 0) {
          valueInstance.setProperties(propertiesToSet);
        }

        // Add hyperlink to alias text after properties are applied
        if (aliasVarToLink) {
          try {
            const aliasUrl = constructVariableUrl(aliasVarToLink.id);
            const textNodes = valueInstance.findAll(node => node.type === 'TEXT') as TextNode[];
            for (const textNode of textNodes) {
              if (textNode.characters.includes(aliasVarToLink.name)) {
                const nameIndex = textNode.characters.indexOf(aliasVarToLink.name);
                if (nameIndex !== -1) {
                  const startIndex = nameIndex;
                  const endIndex = nameIndex + aliasVarToLink.name.length;
                  textNode.setRangeHyperlink(startIndex, endIndex, { type: 'URL', value: aliasUrl });
                  console.log(`🔗 Added hyperlink to alias "${aliasVarToLink.name}": ${aliasUrl}`);
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Could not add hyperlink to alias:', error);
          }
        }
      
      // Apply variable as fill to [swatch] layer if it's a color variable
      if (value && variable.resolvedType === 'COLOR') {
        try {
          // Find the [swatch] layer in the value instance
          let swatchLayer: any = null;
          try {
            swatchLayer = valueInstance.findOne((node: any) => node.name === '[swatch]');
          } catch (findError) {
            console.log('❌ Error finding [swatch] layer:', findError);
          }
          
          if (swatchLayer && 'fills' in swatchLayer) {
            console.log('🎨 Found [swatch] layer, applying variable fill');
            // Use setBoundVariableForPaint helper function with the first fill
            const fills = swatchLayer.fills;
            if (Array.isArray(fills) && fills.length > 0) {
              const firstFill = fills[0];
              if (firstFill.type === 'SOLID') {
                const boundPaint = figma.variables.setBoundVariableForPaint(firstFill, 'color', variable);
                swatchLayer.fills = [boundPaint];

                console.log('✅ Variable bound to [swatch] layer fill with mode:', mode.name);
              } else {
                console.log('⚠️ First fill is not a solid paint');
              }
            } else {
              console.log('⚠️ No fills found on [swatch] layer');
            }
          } else {
            console.log('⚠️ [swatch] layer not found or not compatible in value instance');
          }
        } catch (error) {
          console.log('❌ Error applying variable to [swatch]:', error);
        }
      }
      
      valueInstance.layoutSizingHorizontal = 'FIXED';
      valueInstance.resize(SIZES.variableValueWidth, valueInstance.height);
      row.appendChild(valueInstance);
    }
    
    docFrame.appendChild(row);
  }
  
  // Add footer with variable count
  const footerInstance = footerComponent.createInstance();
  
  // Get the footer component properties
  const footerProps = Object.keys(footerComponent.componentPropertyDefinitions || {});
  console.log('🔧 Footer component properties:', footerProps);
  
  // Find the count property
  const countProp = footerProps.find(prop => prop.indexOf('count') !== -1);
  
  if (countProp) {
    footerInstance.setProperties({ [countProp]: allVariables.length.toString() });
    console.log('✅ Set footer count property:', countProp, 'to:', allVariables.length);
  } else {
    console.log('⚠️ No count property found in footer component');
  }
  
  docFrame.appendChild(footerInstance);
  
  // Set footer to fill the width after adding to auto-layout frame
  footerInstance.layoutSizingHorizontal = 'FILL';
  
  // Always wrap the documentation frame in an auto-layout container
  let targetPage: PageNode | null = null;
  if (!isWrapperChild) {
    targetPage = figma.currentPage;
    deleteDocumentationWrapperByName(targetPage, `[DS Utils] Documentation Wrapper - ${displayName}`);
  }

  const wrapperFrame = figma.createFrame();
  wrapperFrame.name = `[DS Utils] Documentation Wrapper - ${displayName}`;
  wrapperFrame.layoutMode = 'VERTICAL';
  wrapperFrame.primaryAxisSizingMode = 'AUTO';
  wrapperFrame.counterAxisSizingMode = 'AUTO';
  wrapperFrame.paddingLeft = 0;
  wrapperFrame.paddingRight = 0;
  wrapperFrame.paddingTop = 0;
  wrapperFrame.paddingBottom = 0;
  wrapperFrame.itemSpacing = 0;
  wrapperFrame.backgrounds = [];
  
  // Add the documentation frame to the wrapper
  const appendedDoc = safeAppendChild(wrapperFrame, docFrame, 'wrapperFrame.appendChild(docFrame)');
  if (!appendedDoc) {
    showProgress('Error: Failed to assemble documentation frame.');
    return null;
  }
  
  // If this is a wrapper child, don't position it (the parent wrapper will handle positioning)
  if (!isWrapperChild) {
    // Determine target page based on insert mode
    targetPage = figma.currentPage;
    console.log(`🎯 Using current page: "${targetPage.name}"`);
    
    // Ensure the target page is loaded before appending
    try {
      await targetPage.loadAsync();
      console.log(`✅ Target page "${targetPage.name}" loaded successfully`);
    } catch (error) {
      console.log(`❌ Error loading target page: ${error}`);
      // Fallback to current page if loading fails
      targetPage = figma.currentPage;
      console.log(`🔄 Falling back to current page: "${targetPage.name}"`);
    }
    
    const container = getOrCreateDocumentationContainer(targetPage);
    // Move the wrapper frame into the container
    const appendedWrapper = safeAppendChild(container, wrapperFrame, 'container.appendChild(wrapperFrame)');
    if (!appendedWrapper) {
      showProgress('Error: Failed to place documentation frame on page.');
      return null;
    }
    
    // Position the wrapper frame based on insert mode
    wrapperFrame.x = 0;
    wrapperFrame.y = 0;
  } else {
    console.log('📦 Frame is a wrapper child - positioning handled by parent wrapper');
  }
  
  // Center the view on the new wrapper frame
  figma.viewport.scrollAndZoomIntoView([wrapperFrame]);
  
  console.log('✅ Documentation wrapper frame created successfully');
  showProgress(`Documentation frame created for collection: ${collection.name}`);
  
  return {
    name: displayName,
    type: type,
    variableCount: collection.variableIds.length,
    frameId: wrapperFrame.id,
    frameWidth: wrapperFrame.width,
    frame: wrapperFrame
  };
}

export async function runRemoveDocumentationCommand(scope: string) {
  console.log('🗑️ Removing documentation...');
  console.log('📝 Scope:', scope);
  
  // Clear any existing notifications and show initial progress
  showProgress('🗑️ Starting documentation removal...');
  
  try {
    if (scope === 'Current page') {
      console.log('🎯 Removing documentation from current page only');
      showProgress('🎯 Removing documentation from current page...');
      const removedCount = deleteExistingDocumentationFrames(figma.currentPage);
      showProgress(`Documentation frames removed from current page (${removedCount} frames deleted)`);
    } else if (scope === 'All pages') {
      console.log('🎯 Removing documentation from all pages');
      showProgress('🎯 Removing documentation from all pages...');
      const pages = figma.root.children;
      let totalRemoved = 0;
      
      for (const page of pages) {
        const removedCount = deleteExistingDocumentationFrames(page);
        totalRemoved += removedCount;
      }
      
      showProgress(`Documentation frames removed from all pages (${totalRemoved} frames deleted)`);
    } else {
      console.log('❌ Invalid scope:', scope);
      showProgress('Invalid scope. Please select "Current page" or "All pages".');
    }
  } catch (error) {
    console.log('❌ Error removing documentation:', error);
    showProgress('Error removing documentation. Please try again.');
  }
  
  figma.closePlugin();
}
