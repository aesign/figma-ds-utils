// DS Utils Plugin - Color Stops Feature
// Adds intermediate color stops to color palettes by analyzing HSL curves

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

interface ColorStop {
  value: number;
  variable: Variable;
  hsl: { h: number; s: number; l: number };
}

interface ColorScale {
  groupName: string;
  stops: ColorStop[];
  collection: VariableCollection;
}

// ============================================================================
// MAIN COMMAND FUNCTION
// ============================================================================

export async function runAddColorStopCommand(collectionName: string, groupName: string, newValue: string) {
  console.log('🎨 runAddColorStopCommand started');
  console.log('📝 Collection:', collectionName);
  console.log('📝 Group:', groupName);
  console.log('📝 New Value:', newValue);
  
  showProgress('🎨 Adding color stop...');
  
  try {
    const newValueNumber = parseInt(newValue);
    if (isNaN(newValueNumber) || newValueNumber < 0 || newValueNumber > 1000) {
      showProgress('❌ Invalid color value. Please enter a number between 0 and 1000.');
      figma.closePlugin();
      return;
    }
    
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collection = collections.find(c => c.name === collectionName);
    
    if (!collection) {
      showProgress(`❌ Collection "${collectionName}" not found.`);
      figma.closePlugin();
      return;
    }
    
    console.log('✅ Found collection:', collection.name);
    showProgress(`🔍 Analyzing color palette in "${collectionName}"...`);
    
    let success = false;
    if (await hasMultipleSubgroups(collection, groupName)) {
      await processMultipleColorGroups(collection, groupName, newValueNumber);
      success = true;
    } else {
      success = await processSingleColorGroup(collection, groupName, newValueNumber);
    }
    
    if (success) {
      showProgress(`✅ Color stop ${newValueNumber} processed successfully`);
    } else {
      showProgress(`❌ Failed to process color stop ${newValueNumber}`);
    }
    
  } catch (error) {
    console.log('❌ Error in runAddColorStopCommand:', error);
    showProgress(`❌ Error: ${(error as Error).message}`);
  }
  
  figma.closePlugin();
}

async function hasMultipleSubgroups(collection: VariableCollection, groupName: string): Promise<boolean> {
  const subgroups = await findColorGroupsInCollection(collection, groupName);
  return subgroups.length > 1;
}

async function processMultipleColorGroups(collection: VariableCollection, groupPrefix: string, newValue: number) {
  console.log('🌈 Processing multiple color groups with prefix:', groupPrefix);
  showProgress(`🌈 Processing multiple color groups...`);
  
  const colorGroups = await findColorGroupsInCollection(collection, groupPrefix);
  
  if (colorGroups.length === 0) {
    showProgress(`❌ No color groups found with prefix "${groupPrefix}".`);
    return;
  }
  
  console.log(`📊 Found ${colorGroups.length} color groups to process`);
  showProgress(`📊 Found ${colorGroups.length} color groups to process`);
  
  let successCount = 0;
  // Limit number of groups to prevent memory issues
  const maxGroups = 50;
  const limitedGroups = colorGroups.slice(0, maxGroups);
  let totalGroups = limitedGroups.length;
  
  if (colorGroups.length > maxGroups) {
    console.log(`⚠️ Limiting processing to first ${maxGroups} groups (found ${colorGroups.length})`);
    showProgress(`⚠️ Processing first ${maxGroups} of ${colorGroups.length} groups...`);
  }
  
  for (let i = 0; i < limitedGroups.length; i++) {
    const groupName = limitedGroups[i];
    try {
      console.log(`🎨 Processing group ${i + 1}/${totalGroups}: ${groupName}`);
      showProgress(`🎨 Processing ${i + 1}/${totalGroups}: ${groupName}`);
      
      const success = await processSingleColorGroup(collection, groupName, newValue);
      if (success) {
        successCount++;
        // Note: reordering is already handled in processSingleColorGroup
      }
      
      // Add a small delay to prevent overwhelming the system
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.log(`❌ Error processing group ${groupName}:`, error);
    }
  }
  
  showProgress(`✅ Processed color stop ${newValue} in ${successCount}/${totalGroups} groups`);
}

async function processSingleColorGroup(collection: VariableCollection, groupName: string, newValue: number): Promise<boolean> {
  console.log('🎨 Processing single color group:', groupName);
  
  const colorScale = await getColorScale(collection, groupName);
  
  if (!colorScale || colorScale.stops.length < 2) {
    console.log(`❌ Insufficient color stops in group "${groupName}" (need at least 2)`);
    return false;
  }
  
  const existingStop = colorScale.stops.find(stop => stop.value === newValue);
  if (existingStop) {
    console.log(`🔄 Color stop ${newValue} already exists in group "${groupName}" - updating with new calculation`);
    
    // Remove the existing stop from the analysis to get accurate interpolation
    const stopsForAnalysis = colorScale.stops.filter(stop => stop.value !== newValue);
    
    if (stopsForAnalysis.length < 2) {
      console.log(`❌ Cannot update: insufficient remaining color stops for analysis (need at least 2)`);
      return false;
    }
    
    const interpolatedColor = interpolateColorStop(stopsForAnalysis, newValue);
    
    if (!interpolatedColor) {
      console.log(`❌ Could not interpolate color for value ${newValue}`);
      return false;
    }
    
    // Update the existing variable with new color values
    for (const mode of collection.modes) {
      existingStop.variable.setValueForMode(mode.modeId, interpolatedColor);
    }
    
    console.log(`✅ Updated existing color stop: ${existingStop.variable.name}`);
    return true;
  }
  
  console.log(`🔍 Analyzing ${colorScale.stops.length} existing color stops...`);
  
  const interpolatedColor = interpolateColorStop(colorScale.stops, newValue);
  
  if (!interpolatedColor) {
    console.log(`❌ Could not interpolate color for value ${newValue}`);
    return false;
  }
  
  const newVariableName = `${groupName}/${newValue}`;
  console.log(`🆕 Creating new variable: ${newVariableName}`);
  
  const newVariable = figma.variables.createVariable(newVariableName, collection, 'COLOR');
  
  for (const mode of collection.modes) {
    newVariable.setValueForMode(mode.modeId, interpolatedColor);
  }
  
  console.log(`✅ Created new color stop: ${newVariableName}`);
  
  // Reorder variables to maintain numeric sequence
  await reorderVariablesInGroup(collection, groupName);
  
  return true;
}

async function findColorGroupsInCollection(collection: VariableCollection, groupPrefix: string): Promise<string[]> {
  const colorGroups = new Set<string>();
  const cleanPrefix = groupPrefix.endsWith('/') ? groupPrefix.slice(0, -1) : groupPrefix;
  
  // Limit processing to prevent memory issues
  const maxVariables = 1000;
  const variableIds = collection.variableIds.slice(0, maxVariables);
  
  for (const variableId of variableIds) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (variable && variable.resolvedType === 'COLOR') {
        const segments = variable.name.split("/").filter(Boolean);
        
        if (segments.length >= 2) {
          const variableGroupPath = segments.slice(0, -1).join("/");
          
          if (variableGroupPath === cleanPrefix || variableGroupPath.startsWith(cleanPrefix + "/")) {
            colorGroups.add(variableGroupPath);
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Error processing variable ${variableId}:`, error);
      continue;
    }
  }
  
  return Array.from(colorGroups).sort();
}

async function getColorScale(collection: VariableCollection, groupName: string): Promise<ColorScale | null> {
  const stops: ColorStop[] = [];
  
  // Limit processing to prevent memory issues
  const maxVariables = 1000;
  const variableIds = collection.variableIds.slice(0, maxVariables);
  
  for (const variableId of variableIds) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (variable && variable.resolvedType === 'COLOR') {
        const segments = variable.name.split("/").filter(Boolean);
        const variableGroupPath = segments.slice(0, -1).join("/");
        const lastSegment = segments[segments.length - 1];
        
        if (variableGroupPath === groupName) {
          const numericValue = parseInt(lastSegment);
          if (!isNaN(numericValue)) {
            const firstMode = collection.modes[0];
            const colorValue = variable.valuesByMode[firstMode.modeId];
            
            if (colorValue && typeof colorValue === 'object' && 'r' in colorValue) {
              const hsl = rgbToHsl(colorValue as RGB);
              stops.push({
                value: numericValue,
                variable,
                hsl
              });
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Error processing variable ${variableId}:`, error);
      continue;
    }
  }
  
  stops.sort((a, b) => a.value - b.value);
  
  if (stops.length === 0) {
    return null;
  }
  
  return {
    groupName,
    stops,
    collection
  };
}

function interpolateColorStop(stops: ColorStop[], newValue: number): RGB | null {
  if (stops.length < 2) return null;
  
  const sortedStops = stops.slice().sort((a, b) => a.value - b.value);
  console.log('📊 All stops:', sortedStops.map(s => `${s.value}(L:${s.hsl.l.toFixed(1)})`));
  
  let lowerStop: ColorStop | null = null;
  let upperStop: ColorStop | null = null;
  
  // Find interpolation points
  for (let i = 0; i < sortedStops.length - 1; i++) {
    if (newValue >= sortedStops[i].value && newValue <= sortedStops[i + 1].value) {
      lowerStop = sortedStops[i];
      upperStop = sortedStops[i + 1];
      break;
    }
  }
  
  // Handle extrapolation
  if (!lowerStop && !upperStop) {
    if (newValue < sortedStops[0].value) {
      // Extrapolate before the first stop
      lowerStop = sortedStops[0];
      upperStop = sortedStops[1];
      console.log(`📍 Extrapolating BEFORE range (${newValue} < ${sortedStops[0].value})`);
    } else if (newValue > sortedStops[sortedStops.length - 1].value) {
      // Extrapolate after the last stop
      lowerStop = sortedStops[sortedStops.length - 2];
      upperStop = sortedStops[sortedStops.length - 1];
      console.log(`📍 Extrapolating AFTER range (${newValue} > ${sortedStops[sortedStops.length - 1].value})`);
    }
  }
  
  if (!lowerStop || !upperStop) {
    console.log('❌ Could not find interpolation points');
    return null;
  }
  
  const totalRange = upperStop.value - lowerStop.value;
  let factor = totalRange === 0 ? 0 : (newValue - lowerStop.value) / totalRange;
  
  // For extrapolation beyond range, we need to properly extend the trend
  const isExtrapolation = factor < 0 || factor > 1;
  if (isExtrapolation) {
    console.log(`🔄 Extrapolation detected: factor = ${factor.toFixed(3)}`);
  }
  
  console.log(`🎯 Interpolating between ${lowerStop.value} and ${upperStop.value}`);
  console.log(`   Lower HSL: H:${lowerStop.hsl.h.toFixed(1)} S:${lowerStop.hsl.s.toFixed(1)} L:${lowerStop.hsl.l.toFixed(1)}`);
  console.log(`   Upper HSL: H:${upperStop.hsl.h.toFixed(1)} S:${upperStop.hsl.s.toFixed(1)} L:${upperStop.hsl.l.toFixed(1)}`);
  console.log(`   Factor: ${factor.toFixed(3)}`);
  
  const interpolatedHsl = interpolateHslWithCurveDetection(sortedStops, lowerStop, upperStop, factor);
  console.log(`   Result HSL: H:${interpolatedHsl.h.toFixed(1)} S:${interpolatedHsl.s.toFixed(1)} L:${interpolatedHsl.l.toFixed(1)}`);
  
  const rgb = hslToRgb(interpolatedHsl);
  console.log(`   Result RGB: R:${(rgb.r*255).toFixed(0)} G:${(rgb.g*255).toFixed(0)} B:${(rgb.b*255).toFixed(0)}`);
  
  return rgb;
}

async function reorderVariablesInGroup(collection: VariableCollection, groupName: string) {
  console.log(`🔄 Reordering variables in group: ${groupName}`);
  showProgress(`🔄 Reordering color stops...`);
  
  try {
    // Get all variables in this group
    const groupVariables: Array<{
      variable: Variable;
      value: number;
      colorValues: { [modeId: string]: RGB | RGBA };
    }> = [];
    
    // Limit processing to prevent memory issues
    const maxVariables = 1000;
    const variableIds = collection.variableIds.slice(0, maxVariables);
    
    for (const variableId of variableIds) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (variable && variable.resolvedType === 'COLOR') {
          const segments = variable.name.split("/").filter(Boolean);
          const variableGroupPath = segments.slice(0, -1).join("/");
          const lastSegment = segments[segments.length - 1];
          
          if (variableGroupPath === groupName) {
            const numericValue = parseInt(lastSegment);
            if (!isNaN(numericValue)) {
              // Store color values for all modes
              const colorValues: { [modeId: string]: RGB | RGBA } = {};
              for (const mode of collection.modes) {
                const colorValue = variable.valuesByMode[mode.modeId];
                if (colorValue && typeof colorValue === 'object' && 'r' in colorValue) {
                  colorValues[mode.modeId] = colorValue as RGB | RGBA;
                }
              }
              
              groupVariables.push({
                variable,
                value: numericValue,
                colorValues
              });
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Error processing variable ${variableId}:`, error);
        continue;
      }
    }
    
    if (groupVariables.length === 0) {
      console.log(`⚠️ No variables found in group ${groupName}`);
      return;
    }
    
    // Sort by numeric value
    groupVariables.sort((a, b) => a.value - b.value);
    console.log(`📊 Found ${groupVariables.length} variables to reorder:`, groupVariables.map(v => v.value));
    
    // Remove all variables in this group
    for (const item of groupVariables) {
      item.variable.remove();
    }
    
    // Recreate variables in sorted order
    for (const item of groupVariables) {
      const newVariableName = `${groupName}/${item.value}`;
      const newVariable = figma.variables.createVariable(newVariableName, collection, 'COLOR');
      
      // Restore all mode values
      for (const mode of collection.modes) {
        const colorValue = item.colorValues[mode.modeId];
        if (colorValue) {
          newVariable.setValueForMode(mode.modeId, colorValue);
        }
      }
      
      console.log(`🔄 Recreated variable: ${newVariableName}`);
    }
    
    console.log(`✅ Successfully reordered ${groupVariables.length} variables in ${groupName}`);
    
  } catch (error) {
    console.log(`❌ Error reordering variables:`, error);
    // Don't fail the entire operation if reordering fails
  }
}

function interpolateHslWithCurveDetection(
  allStops: ColorStop[], 
  lowerStop: ColorStop, 
  upperStop: ColorStop, 
  factor: number
): { h: number; s: number; l: number } {
  
  // For extrapolation beyond the range, use a more sophisticated approach
  const isExtrapolation = factor < 0 || factor > 1;
  
  if (isExtrapolation && allStops.length >= 3) {
    console.log('🔄 Using extrapolation logic');
    return extrapolateHslValue(allStops, lowerStop, upperStop, factor);
  }
  
  const easingCurves = detectEasingCurves(allStops);
  console.log('🔍 Applying easing curves:', easingCurves);
  
  const easedFactorL = applyEasing(Math.max(0, Math.min(1, factor)), easingCurves.lightness);
  const easedFactorS = applyEasing(Math.max(0, Math.min(1, factor)), easingCurves.saturation);
  
  const result = {
    h: interpolateHue(lowerStop.hsl.h, upperStop.hsl.h, factor),
    s: interpolateValue(lowerStop.hsl.s, upperStop.hsl.s, easedFactorS),
    l: interpolateValue(lowerStop.hsl.l, upperStop.hsl.l, easedFactorL)
  };
  
  console.log(`   Eased factors: L:${easedFactorL.toFixed(3)}, S:${easedFactorS.toFixed(3)}`);
  
  return result;
}

function extrapolateHslValue(
  allStops: ColorStop[], 
  lowerStop: ColorStop, 
  upperStop: ColorStop, 
  factor: number
): { h: number; s: number; l: number } {
  console.log('🔮 Extrapolating HSL values');
  
  // Calculate the trend from the broader context
  const sortedStops = allStops.slice().sort((a, b) => a.value - b.value);
  
  // For extrapolation beyond the end (like 975 when max is 950)
  if (factor > 1) {
    // Use the last 3 stops to determine the trend
    const len = sortedStops.length;
    if (len >= 3) {
      const stop1 = sortedStops[len - 3];
      const stop2 = sortedStops[len - 2];
      const stop3 = sortedStops[len - 1];
      
      // Calculate the rate of change for lightness
      const deltaL1 = stop2.hsl.l - stop1.hsl.l;
      const deltaL2 = stop3.hsl.l - stop2.hsl.l;
      const deltaV1 = stop2.value - stop1.value;
      const deltaV2 = stop3.value - stop2.value;
      
      // Determine if lightness is decreasing (typical for darker shades)
      const lightnessRate = deltaV2 > 0 ? deltaL2 / deltaV2 : deltaL2;
      
      console.log(`   Lightness trend: ${deltaL1.toFixed(2)} -> ${deltaL2.toFixed(2)} (rate: ${lightnessRate.toFixed(4)})`);
      
      // For higher values, lightness should typically decrease (darker colors)
      const valueExtension = (factor - 1) * (upperStop.value - lowerStop.value);
      const newL = upperStop.hsl.l + (lightnessRate * valueExtension);
      
      // For saturation, usually it stays similar or slightly increases
      const deltaS1 = stop2.hsl.s - stop1.hsl.s;
      const deltaS2 = stop3.hsl.s - stop2.hsl.s;
      const saturationRate = deltaV2 > 0 ? deltaS2 / deltaV2 : deltaS2;
      const newS = upperStop.hsl.s + (saturationRate * valueExtension);
      
      return {
        h: interpolateHue(lowerStop.hsl.h, upperStop.hsl.h, factor),
        s: Math.max(0, Math.min(100, newS)),
        l: Math.max(0, Math.min(100, newL))
      };
    }
  }
  
  // Fallback to linear extrapolation
  return {
    h: interpolateHue(lowerStop.hsl.h, upperStop.hsl.h, factor),
    s: interpolateValue(lowerStop.hsl.s, upperStop.hsl.s, factor),
    l: interpolateValue(lowerStop.hsl.l, upperStop.hsl.l, factor)
  };
}

function detectEasingCurves(stops: ColorStop[]): { lightness: string; saturation: string } {
  if (stops.length < 3) {
    return { lightness: 'linear', saturation: 'linear' };
  }
  
  const lightnessDeltas = [];
  for (let i = 1; i < stops.length; i++) {
    const deltaL = Math.abs(stops[i].hsl.l - stops[i - 1].hsl.l);
    const deltaV = stops[i].value - stops[i - 1].value;
    lightnessDeltas.push(deltaV > 0 ? deltaL / deltaV : 0);
  }
  
  const saturationDeltas = [];
  for (let i = 1; i < stops.length; i++) {
    const deltaS = Math.abs(stops[i].hsl.s - stops[i - 1].hsl.s);
    const deltaV = stops[i].value - stops[i - 1].value;
    saturationDeltas.push(deltaV > 0 ? deltaS / deltaV : 0);
  }
  
  const lightnessEasing = analyzeDeltaPattern(lightnessDeltas);
  const saturationEasing = analyzeDeltaPattern(saturationDeltas);
  
  console.log('🔍 Detected easing curves:', { lightness: lightnessEasing, saturation: saturationEasing });
  
  return { lightness: lightnessEasing, saturation: saturationEasing };
}

function analyzeDeltaPattern(deltas: number[]): string {
  if (deltas.length < 2) return 'linear';
  
  let increasing = 0;
  let decreasing = 0;
  
  for (let i = 1; i < deltas.length; i++) {
    const diff = deltas[i] - deltas[i - 1];
    if (diff > 0.01) increasing++;
    else if (diff < -0.01) decreasing++;
  }
  
  if (increasing > decreasing * 1.5) return 'ease-in';
  if (decreasing > increasing * 1.5) return 'ease-out';
  return 'linear';
}

function applyEasing(factor: number, easingType: string): number {
  switch (easingType) {
    case 'ease-in':
      return factor * factor;
    case 'ease-out':
      return 1 - (1 - factor) * (1 - factor);
    case 'ease-in-out':
      return factor < 0.5 ? 2 * factor * factor : 1 - 2 * (1 - factor) * (1 - factor);
    default:
      return factor;
  }
}

function interpolateValue(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

function interpolateHue(startHue: number, endHue: number, factor: number): number {
  let delta = endHue - startHue;
  
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  
  let result = startHue + delta * factor;
  
  if (result < 0) result += 360;
  if (result >= 360) result -= 360;
  
  return result;
}

function rgbToHsl(rgb: RGB): { h: number; s: number; l: number } {
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number;
  let s: number;
  const l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
      default:
        h = 0;
    }
  }
  
  return {
    h: h * 360,
    s: s * 100,
    l: l * 100
  };
}

function hslToRgb(hsl: { h: number; s: number; l: number }): RGB {
  // Validate and clamp HSL values
  let h = ((hsl.h % 360) + 360) % 360; // Ensure 0-360
  let s = Math.max(0, Math.min(100, hsl.s)); // Clamp 0-100
  let l = Math.max(0, Math.min(100, hsl.l)); // Clamp 0-100
  
  console.log(`🔄 Converting HSL(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%) to RGB`);
  
  // Convert to 0-1 range
  h = h / 360;
  s = s / 100;
  l = l / 100;
  
  if (s === 0) {
    // Achromatic (grayscale)
    const gray = Math.max(0, Math.min(1, l));
    return { r: gray, g: gray, b: gray };
  }
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  
  const r = Math.max(0, Math.min(1, hue2rgb(p, q, h + 1/3)));
  const g = Math.max(0, Math.min(1, hue2rgb(p, q, h)));
  const b = Math.max(0, Math.min(1, hue2rgb(p, q, h - 1/3)));
  
  console.log(`   Final RGB: (${(r*255).toFixed(0)}, ${(g*255).toFixed(0)}, ${(b*255).toFixed(0)})`);
  
  return { r, g, b };
}
