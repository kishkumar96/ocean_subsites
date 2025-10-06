# UI Configuration and Shared Components Architecture

## Overview

This refactoring addresses the problem of hard-coded UI elements, emoji labels, and string maps scattered throughout the ForecastApp component. The new architecture provides:

1. **Centralized Configuration** - All UI text, icons, and labels in one place
2. **Shared Components** - Reusable components with consistent styling
3. **Accessibility First** - Proper ARIA labels and semantic markup
4. **Easy Maintenance** - Changes to copy or styling affect all widgets

## Architecture Components

### 1. UI Configuration (`src/config/uiConfig.js`)

Centralized configuration for:
- **Section Headers**: Icons, titles, and ARIA labels
- **Variable Labels**: Consistent mapping of long names to short display names
- **Playback Controls**: Play/pause icons and accessibility text
- **Legend Controls**: Show/hide labels with proper accessibility
- **Data Source Info**: Model, resolution, update frequency details
- **Format Functions**: Consistent number formatting and display

### 2. Shared UI Components (`src/components/shared/UIComponents.js`)

Reusable components with built-in accessibility:
- **ControlGroup**: Consistent section container with role="group"
- **VariableButtons**: Radio group for forecast variable selection
- **TimeControl**: Complete time slider and playback controls
- **OpacityControl**: Opacity slider with live percentage display
- **DataInfo**: Structured data source information display
- **StatusBar**: Footer with copyright and status information

## Benefits

### Before Refactoring
```jsx
// Hard-coded labels scattered throughout component
<h3>📊 Forecast Variables</h3>
<h3>⏰ Forecast Time</h3>
<h3>🎨 Display Options</h3>

// Inline string mapping
const labelMap = {
  'Significant Wave Height': 'Wave Height',
  'Wave Direction (arrow)': 'Wave Direction',
  // ... more mappings
};

// Inconsistent accessibility
<input aria-label="overlay-opacity" />
<button>{isPlaying ? '⏸️ Pause' : '▶️ Play'}</button>
```

### After Refactoring
```jsx
// Centralized configuration
<ControlGroup
  icon={UI_CONFIG.SECTIONS.FORECAST_VARIABLES.icon}
  title={UI_CONFIG.SECTIONS.FORECAST_VARIABLES.title}
  ariaLabel={UI_CONFIG.SECTIONS.FORECAST_VARIABLES.ariaLabel}
>
  <VariableButtons
    layers={ALL_LAYERS}
    selectedValue={selectedWaveForecast}
    onVariableChange={handleVariableChange}
    labelMap={UI_CONFIG.VARIABLE_LABELS}
  />
</ControlGroup>
```

## Usage Guidelines

### Adding New Widgets

1. **Import the configuration:**
```jsx
import UI_CONFIG from '../config/uiConfig';
import { ControlGroup, VariableButtons } from '../components/shared/UIComponents';
```

2. **Use consistent patterns:**
```jsx
<ControlGroup
  icon={UI_CONFIG.SECTIONS.YOUR_SECTION.icon}
  title={UI_CONFIG.SECTIONS.YOUR_SECTION.title}
  ariaLabel={UI_CONFIG.SECTIONS.YOUR_SECTION.ariaLabel}
>
  {/* Your content */}
</ControlGroup>
```

### Customizing for Different Regions

Add region-specific configurations:
```jsx
// In uiConfig.js
export const REGION_CONFIG = {
  COOK_ISLANDS: {
    coverage: 'Cook Islands',
    source: 'Pacific Community (SPC)'
  },
  PACIFIC: {
    coverage: 'Pacific Region',
    source: 'NOAA/Pacific Marine Center'
  }
};
```

### Maintaining Consistency

1. **All UI text** should come from `uiConfig.js`
2. **All icons and emojis** should be centralized
3. **ARIA labels** should be comprehensive and descriptive
4. **Format functions** should handle all number/date formatting
5. **Component props** should be consistent across widgets

## Migration Path for Other Widgets

1. **Audit existing widgets** for hard-coded strings and inline mappings
2. **Extract common patterns** into shared components
3. **Update configuration** with widget-specific sections
4. **Test accessibility** with screen readers and keyboard navigation
5. **Document component APIs** for other developers

## Accessibility Improvements

- **Semantic markup**: `role="group"`, `role="radiogroup"`, `role="radio"`
- **ARIA labels**: Comprehensive labels for all interactive elements
- **Keyboard navigation**: Proper tab order and focus management
- **Screen reader support**: Meaningful descriptions for all controls

## File Structure
```
src/
├── config/
│   └── uiConfig.js          # Centralized UI configuration
├── components/
│   ├── shared/
│   │   └── UIComponents.js  # Reusable UI components
│   └── ForecastApp.jsx      # Refactored main component
```

This architecture ensures that maintaining copy, accessibility text, and control layouts across multiple widgets becomes manageable and consistent.