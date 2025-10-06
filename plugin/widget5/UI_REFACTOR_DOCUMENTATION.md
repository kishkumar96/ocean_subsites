# UI Configuration and Component Architecture

## Overview

This refactor addresses the hard-coded UI elements and string mappings in ForecastApp.jsx by introducing a proper configuration layer and shared component system. The new architecture provides:

- **Centralized Configuration**: All UI text, labels, icons, and metadata in one place
- **Shared Components**: Reusable UI components with consistent styling and accessibility
- **Regional Customization**: Easy adaptation for different regions/countries
- **Maintainability**: Changes to copy, styling, or behavior propagate automatically
- **Accessibility**: Built-in ARIA labels, keyboard navigation, and screen reader support

## Architecture Components

### 1. Configuration Layer (`src/config/`)

#### `UIConfig.js`
Central configuration for all UI elements:
```javascript
// Section headers with icons and accessibility
sections: {
  forecastTime: {
    icon: '⏰',
    title: 'Forecast Time',
    ariaLabel: 'Forecast time controls'
  }
}

// Control labels and accessibility text
controls: {
  timeSlider: {
    label: 'Forecast Time',
    ariaLabel: 'Select forecast time',
    title: 'Drag to change forecast time'
  }
}

// Layer label mappings
layerLabels: {
  'Significant Wave Height': 'Wave Height',
  'Wave Direction (arrow)': 'Wave Direction'
}
```

#### `WidgetConfigProvider.jsx`
React context provider for configuration with regional overrides:
```javascript
<WidgetConfigProvider region="Cook Islands" theme="default">
  <ForecastApp />
</WidgetConfigProvider>
```

### 2. Shared Components (`src/components/ui/`)

#### `SharedComponents.jsx`
Base reusable components:
- `ControlGroup` - Consistent section container with accessibility
- `AccessibleSlider` - ARIA-compliant range slider with labels
- `ActionButton` - Standardized buttons with variants
- `InfoDisplay` - Flexible information display component
- `VariableSelector` - Layer selection buttons

#### `ForecastComponents.jsx`
Forecast-specific composed components:
- `TimeControl` - Complete time slider and playback controls
- `OpacityControl` - Opacity adjustment with percentage display
- `DataInfoPanel` - Model and source information display
- `StatusBar` - Footer with copyright information

#### `SharedComponents.css`
Comprehensive styles with:
- Consistent theming variables
- Responsive design breakpoints
- Accessibility-focused interactions
- Dark/light theme support

## Benefits

### Before (Hard-coded)
```jsx
<div className="control-group">
  <h3>⏰ Forecast Time</h3>
  <input 
    type="range" 
    aria-label="Forecast Time"
    // ... more hard-coded attributes
  />
  <button onClick={handlePlay}>
    {isPlaying ? '⏸️ Pause' : '▶️ Play'}
  </button>
</div>
```

### After (Configurable)
```jsx
<ControlGroup
  title={getSectionConfig('forecastTime').title}
  icon={getSectionConfig('forecastTime').icon}
  ariaLabel={getSectionConfig('forecastTime').ariaLabel}
>
  <TimeControl
    sliderIndex={sliderIndex}
    onPlayToggle={handlePlayToggle}
    // ... other props
  />
</ControlGroup>
```

### Maintenance Improvements

1. **Single Source of Truth**: All UI text in `UIConfig.js`
2. **Consistent Styling**: Shared CSS ensures visual consistency
3. **Accessibility Built-in**: ARIA labels and keyboard navigation
4. **Easy Localization**: Replace text objects for different languages
5. **Regional Adaptation**: Override configuration for different regions
6. **Type Safety**: PropTypes validation on all components

## Usage Examples

### Regional Customization
```javascript
// For Fiji deployment
const fijiConfig = getRegionalConfig('FIJI');
// Automatically updates coverage, timezone, copyright

<WidgetConfigProvider config={fijiConfig} region="Fiji">
  <ForecastApp />
</WidgetConfigProvider>
```

### Layer Label Customization
```javascript
// Add new mappings in UIConfig.js
layerLabels: {
  'New Layer Name': 'Short Name',
  'Another Layer': 'Brief'
}
```

### Theme Customization
```css
/* Override CSS custom properties */
:root {
  --primary-color: #custom-blue;
  --accent-color: #custom-green;
}
```

## Migration Benefits

1. **Zero Breaking Changes**: Maintains all existing functionality
2. **Incremental Adoption**: Can be adopted gradually across widgets
3. **Performance**: No impact on render performance
4. **Bundle Size**: Minimal increase due to better code organization
5. **Developer Experience**: Much easier to maintain and extend

## Future Enhancements

1. **Internationalization**: Easy to add i18n support
2. **Theme System**: Support for multiple visual themes
3. **A/B Testing**: Easy to test different UI configurations
4. **Analytics**: Built-in instrumentation points
5. **Component Library**: Export for use across multiple widgets

This architecture transformation makes the codebase much more maintainable while preserving all existing functionality and improving accessibility.