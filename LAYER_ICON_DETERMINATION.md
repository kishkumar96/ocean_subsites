# Layer Icon Determination - Dynamic Icon Selection

## Answer to Your Question

**The file that determines the Lucide icon is:**
```
/home/kishank/ocean_subsites/plugin/widget5/src/components/ForecastApp.jsx
```

Specifically at **lines 567-571** (now updated to use dynamic icon selection).

---

## What Was Changed

### Before (Hardcoded)
All layers used the same icon:
```jsx
<FancyIcon 
  icon={Waves}           // ❌ Always waves
  animationType="wave" 
  size={18} 
  color="#00bcd4"        // ❌ Always cyan
/>
```

### After (Dynamic Selection)
Icons are now chosen based on layer type:
```jsx
<FancyIcon 
  icon={getLayerIcon(selectedLayer).icon}    // ✅ Dynamic
  animationType="wave" 
  size={18} 
  color={getLayerIcon(selectedLayer).color}  // ✅ Dynamic
/>
```

---

## New Helper Function

Added `getLayerIcon()` function in `ForecastApp.jsx`:

```javascript
/**
 * Determines the appropriate icon for a layer based on its properties
 */
const getLayerIcon = (layer) => {
  if (!layer) return { icon: Waves, color: '#00bcd4' };
  
  const layerName = layer.value?.toLowerCase() || '';
  const layerLabel = layer.label?.toLowerCase() || '';
  
  // Inundation layers
  if (layerName.includes('inun') || layerLabel.includes('inundation')) {
    return { icon: CloudRain, color: '#4fc3f7' }; // Light blue
  }
  
  // Wave height layers
  if (layerName.includes('hs') || layerLabel.includes('wave height')) {
    return { icon: Waves, color: '#00bcd4' }; // Cyan
  }
  
  // Wave period layers
  if (layerName.includes('tm02') || layerName.includes('tpeak') || layerLabel.includes('period')) {
    return { icon: Activity, color: '#9c27b0' }; // Purple
  }
  
  // Wave direction layers
  if (layerName.includes('dirm') || layerLabel.includes('direction')) {
    return { icon: Navigation, color: '#ff9800' }; // Orange
  }
  
  // Wind layers
  if (layerName.includes('wind') || layerLabel.includes('wind')) {
    return { icon: Wind, color: '#4caf50' }; // Green
  }
  
  // Default to waves icon
  return { icon: Waves, color: '#00bcd4' };
};
```

---

## Icon Mapping

| Layer Type | Icon | Color | Lucide Component |
|------------|------|-------|------------------|
| **Inundation** | 🌧️ Rain Cloud | `#4fc3f7` (Light Blue) | `CloudRain` |
| **Wave Height** | 🌊 Waves | `#00bcd4` (Cyan) | `Waves` |
| **Wave Period** | 📊 Activity | `#9c27b0` (Purple) | `Activity` |
| **Wave Direction** | 🧭 Navigation | `#ff9800` (Orange) | `Navigation` |
| **Wind** | 💨 Wind | `#4caf50` (Green) | `Wind` |
| **Default** | 🌊 Waves | `#00bcd4` (Cyan) | `Waves` |

---

## Your HTML Inspection

From your HTML, you saw:
```html
<svg class="lucide lucide-waves">
  <!-- Waves icon SVG paths -->
</svg>
```

**Now for Rarotonga Inundation, you'll see:**
```html
<svg class="lucide lucide-cloud-rain">
  <!-- CloudRain icon SVG paths -->
</svg>
```

---

## Components Involved

### 1. **ForecastApp.jsx** (Main Logic)
- Contains the metadata panel rendering
- Now uses `getLayerIcon()` to determine icon
- Lines 567-571 (the specific HTML you inspected)

### 2. **FancyIcon.jsx** (Icon Wrapper)
- Wraps Lucide icons with animations
- Applies framer-motion effects
- Provides the `fancy-icon-wrapper` class you saw

### 3. **Lucide React** (Icon Library)
- Imported icons: `Waves`, `CloudRain`, `Activity`, `Navigation`, `Wind`, etc.
- Renders actual SVG elements

---

## How It Works

```
Layer Selected
      ↓
getLayerIcon(layer)
      ↓
Check layer.value & layer.label
      ↓
Match pattern (inun, hs, tm02, dirm, wind)
      ↓
Return { icon: ComponentName, color: '#hex' }
      ↓
Pass to <FancyIcon />
      ↓
Render Lucide SVG with animation
      ↓
Displayed in metadata panel
```

---

## Example Outputs

### For Rarotonga Inundation:
```javascript
layer.value = "raro_inun/Band1"
layer.label = "🌧️ Rarotonga Inundation"

getLayerIcon(layer) returns:
{
  icon: CloudRain,  // Rain cloud icon
  color: '#4fc3f7'  // Light blue
}
```

### For Wave Height:
```javascript
layer.value = "cook_forecast/hs"
layer.label = "Significant Wave Height"

getLayerIcon(layer) returns:
{
  icon: Waves,      // Waves icon
  color: '#00bcd4'  // Cyan
}
```

---

## CSS Classes Generated

The HTML structure you saw:
```html
<div class="fancy-icon-wrapper">  <!-- Wrapper from FancyIcon.jsx -->
  <div style="...">               <!-- Framer Motion div -->
    <svg class="lucide lucide-cloud-rain">  <!-- Lucide icon -->
      <!-- SVG paths -->
    </svg>
  </div>
</div>
```

---

## Benefits of This Change

### ✅ Better Visual Communication
- Inundation → Rain cloud icon (makes sense!)
- Waves → Wave icon
- Wind → Wind icon
- Each layer has appropriate visual representation

### ✅ Color Coding
- Different colors help distinguish layer types at a glance
- Consistent with layer semantics

### ✅ Extensible
- Easy to add new layer types
- Just add another `if` condition in `getLayerIcon()`

### ✅ Maintainable
- All icon logic in one place
- Pattern matching based on layer properties

---

## Summary

**File**: `/home/kishank/ocean_subsites/plugin/widget5/src/components/ForecastApp.jsx`  
**Function**: `getLayerIcon(layer)` (new)  
**Usage**: Lines 567-571 in metadata panel header  
**Result**: Dynamic icon selection based on layer type  

**For Rarotonga Inundation**:
- Icon: `CloudRain` 🌧️
- Color: `#4fc3f7` (light blue)
- Makes more sense than generic waves icon!

The icon is now determined dynamically and will automatically show the correct icon for each layer type! 🎉
