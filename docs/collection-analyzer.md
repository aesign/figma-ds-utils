# Collection Analyzer - Dynamic Mode Discovery

## 🚀 **Overview**

The Collection Analyzer is a powerful new feature that **dynamically discovers and analyzes** your Figma variable collections, automatically detecting semantic structures like themes, materials, and appearances. No hardcoding required!

## 🔍 **What It Does**

### **1. Automatic Discovery**
- **Scans all collections** (local and library)
- **Detects semantic categories**: theme, material, appearance, content, other
- **Analyzes variable structures** and grouping patterns
- **Discovers modes** and their relationships

### **2. Smart Categorization**
- **Theme Collections**: `semantic/theme`, collections with mode-based structures
- **Material Collections**: `semantic/material`, surface/material variables
- **Appearance Collections**: `semantic/appearance`, style-based variables
- **Content Collections**: text, i18n, content variables

### **3. Developer Tools**
- **CSS Custom Properties**: Auto-generated theme classes
- **HTML Helpers**: JavaScript functions for mode switching
- **Mode Management**: Programmatic theme/mode control

## 📊 **Using the Analyzer**

### **1. Run Analysis**
```
Figma Menu → DS Utilities → Analyze Collections
```

### **2. View Results**
- **Overview Tab**: Summary of all collections and their semantic categories
- **Themes Tab**: Available theme modes with apply buttons
- **CSS Tab**: Generated CSS custom properties
- **HTML Tab**: Generated HTML/JS helpers

### **3. Apply Themes**
Click "Apply" next to any theme mode to set it programmatically.

## 💻 **Generated Code Examples**

### **CSS Custom Properties**
```css
/* Auto-generated CSS Custom Properties from Figma Variables */

/* Theme Mode Classes */
[data-theme="light"] {
  --figma-theme-mode: "light";
  --figma-theme-id: "VariableID:123:456";
}

[data-theme="dark"] {
  --figma-theme-mode: "dark";
  --figma-theme-id: "VariableID:123:789";
}

/* Material Mode Classes */
[data-material="glass"] {
  --figma-material-mode: "glass";
  --figma-material-id: "VariableID:456:789";
}
```

### **HTML Mode Helpers**
```html
<!-- Auto-generated HTML helpers for Figma variable modes -->

<!-- Theme Selector -->
<script>
function setFigmaTheme(themeName) {
  document.documentElement.setAttribute("data-theme", themeName);
  localStorage.setItem("figma-theme", themeName);
}

function getFigmaTheme() {
  return document.documentElement.getAttribute("data-theme") || localStorage.getItem("figma-theme");
}

// Available themes:
// setFigmaTheme("light");
// setFigmaTheme("dark");
</script>
```

## 🎯 **Developer Usage**

### **1. Set Theme in HTML**
```html
<!DOCTYPE html>
<html data-theme="dark" data-material="glass">
<head>
  <!-- Your CSS with Figma variables -->
</head>
<body>
  <!-- Your content -->
</body>
</html>
```

### **2. Switch Themes Dynamically**
```javascript
// Switch to dark theme
setFigmaTheme("dark");

// Switch to glass material
document.documentElement.setAttribute("data-material", "glass");

// Get current theme
const currentTheme = getFigmaTheme();
```

### **3. CSS Variable Usage**
```css
.my-component {
  /* Use Figma's CSS variables */
  background: var(--figma-color-bg);
  color: var(--figma-color-text);
  
  /* Use mode-specific variables */
  opacity: var(--figma-theme-mode) === 'dark' ? 0.8 : 1;
}
```

## 🔧 **Programmatic API**

The analyzer also provides programmatic access:

```typescript
// Get available themes
const themes = await getAvailableThemes();

// Get available materials  
const materials = await getAvailableMaterials();

// Set theme mode
const success = await setThemeMode("dark");

// Generate CSS
const css = await generateCSSCustomProperties();
```

## 🌟 **Benefits**

### **1. Dynamic Discovery**
- ✅ **No hardcoding** - works with any collection structure
- ✅ **Automatic detection** - finds semantic collections intelligently
- ✅ **Future-proof** - adapts as collections change

### **2. Developer Experience**
- ✅ **Copy-paste ready** CSS and HTML
- ✅ **Standard HTML attributes** (`data-theme`, `data-material`)
- ✅ **localStorage persistence** for theme preferences
- ✅ **Figma-native** CSS variables

### **3. Design System Integration**
- ✅ **Semantic understanding** of your design system
- ✅ **Mode-aware** variable management
- ✅ **Cross-platform** CSS generation

## 🔄 **Collection Structure Support**

The analyzer automatically handles various collection structures:

```
✅ semantic/theme (with light, dark modes)
✅ semantic/material (with glass, solid, etc.)
✅ semantic/appearance (with compact, comfortable, etc.)
✅ 0 base/palette (color foundations)
✅ 1 semantic/main (semantic tokens)
✅ Custom collection names and structures
```

## 🚀 **Next Steps**

1. **Run the analyzer** on your current collections
2. **Copy the generated CSS** to your stylesheets
3. **Use the HTML helpers** in your projects
4. **Set themes programmatically** using the provided functions
5. **Re-run analysis** whenever collections change

The system is completely **dynamic and non-destructive** - it only reads your collections and generates helper code!
