// DS Utils Plugin - Dev Status Feature
// Handles setting dev status on selected frames and sections

// ============================================================================
// MAIN COMMAND FUNCTION
// ============================================================================

export async function runSetDevStatusCommand(status: string) {
  console.log('🚀 runSetDevStatusCommand called with status:', status);
  
  // Get current selection
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('❌ Please select a frame or section to set dev status');
    figma.closePlugin();
    return;
  }
  
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];
  
  for (const node of selection) {
    try {
      // Check if the node supports devStatus property
      if (!supportsDevStatus(node)) {
        console.log(`⚠️ Node ${node.name} (${node.type}) does not support devStatus`);
        skippedCount++;
        continue;
      }
      
      // Validate node can have devStatus (must be directly under page or section)
      if (!canSetDevStatus(node)) {
        console.log(`⚠️ Node ${node.name} cannot have devStatus - not directly under page or section`);
        errors.push(`${node.name}: Must be directly under page or section`);
        skippedCount++;
        continue;
      }
      
      // Set the dev status
      const devStatusObject = mapStatusToDevStatus(status);
      if (devStatusObject) {
        (node as any).devStatus = devStatusObject;
        console.log(`✅ Set devStatus to ${devStatusObject.type} for node: ${node.name}`);
        updatedCount++;
      } else if (status === 'Clear Status') {
        // Clear the dev status
        (node as any).devStatus = null;
        console.log(`✅ Cleared devStatus for node: ${node.name}`);
        updatedCount++;
      } else {
        console.log(`❌ Unknown status: ${status}`);
        errors.push(`${node.name}: Unknown status "${status}"`);
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Error setting devStatus for ${node.name}:`, error);
      errors.push(`${node.name}: ${(error as Error).message}`);
      skippedCount++;
    }
  }
  
  // Generate results message
  let message = '';
  if (updatedCount > 0) {
    message += `✅ Updated ${updatedCount} node${updatedCount === 1 ? '' : 's'}`;
  }
  if (skippedCount > 0) {
    message += (message ? ', ' : '') + `⚠️ Skipped ${skippedCount} node${skippedCount === 1 ? '' : 's'}`;
  }
  if (errors.length > 0 && errors.length <= 3) {
    message += '\n' + errors.join('\n');
  } else if (errors.length > 3) {
    message += `\n${errors.slice(0, 2).join('\n')}\n... and ${errors.length - 2} more errors`;
  }
  
  if (message) {
    figma.notify(message, { timeout: 4000 });
  } else {
    figma.notify('❌ No changes made', { error: true });
  }
  
  figma.closePlugin();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function supportsDevStatus(node: SceneNode): boolean {
  // DevStatus is supported on FrameNode, SectionNode, and ComponentNode
  return node.type === 'FRAME' || 
         node.type === 'SECTION' || 
         node.type === 'COMPONENT';
}

function canSetDevStatus(node: SceneNode): boolean {
  // Can only be set on a node directly under a page or section
  if (!node.parent) return false;
  
  // Must be directly under a page
  if (node.parent.type === 'PAGE') return true;
  
  // Must be directly under a section
  if (node.parent.type === 'SECTION') return true;
  
  // Cannot be set if inside another node that already has devStatus
  if (node.parent.type === 'FRAME' || node.parent.type === 'COMPONENT') {
    // Check if parent has devStatus
    if ('devStatus' in node.parent && (node.parent as any).devStatus) {
      return false;
    }
  }
  
  return false;
}

function mapStatusToDevStatus(status: string): { type: string } | null {
  switch (status) {
    case 'Ready for Development':
      return {
        type: 'READY_FOR_DEV'
      };
    case 'Completed':
      return {
        type: 'COMPLETE'
      };
    case 'Clear Status':
      return null;
    default:
      return null;
  }
}
