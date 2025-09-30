# Adding tp_p1 (Wind Wave Period) to Widget 5

## Implementation Summary

Widget 5 now includes the `tp_p1` (Wind Wave Period) variable, matching the functionality available in Widget 1. This provides users with comprehensive wave period analysis including both peak periods and wind wave periods.

## Changes Made

### 1. **Layer Configuration (Home.jsx)**
- Added `tp_p1` configuration to `getWorldClassConfig()` function
- Added new layer to `WAVE_FORECAST_LAYERS` array:
  ```jsx
  {
    label: "🌊 Wind Wave Period",
    value: "cook_forecast/tp_p1", 
    id: 6,
    colorscalerange: "0,29.32",  // Based on server metadata
    style: "default-scalar/psu-plasma"
  }
  ```

### 2. **WMS Tile Layer Support (addWMSTileLayer.js)**
- Added automatic color scale range setting for `tp_p1`
- Enhanced error handling for wind wave period data
- Uses plasma color palette for optimal visualization

### 3. **Timeseries Support (timeseries.js)**
- Added `tp_p1` to variable configurations:
  ```javascript
  tp_p1: {
    label: 'Wind Wave Period',
    unit: 's',
    range: { min: 0, max: 29 },
    palette: 'plasma'
  }
  ```
- Included in `variableKeys` array for data processing

### 4. **Tabular Data Support (tabular.js)**
- Added tabular display configuration:
  ```javascript
  'tp_p1': { key: "tp_p1", label: "Wind Wave Period{0-29/Plasma/0}" }
  ```

### 5. **Data Canvas Integration (BottomOffCanvas.jsx)**
- Added `tp_p1` to `FORECAST_VARIABLE_KEYS` array
- Enables data fetching and display in bottom panel

### 6. **Legend System (WorldClassVisualization.js)**
- Added layer mapping for `cook_forecast/tp_p1`
- Configured plasma palette for wind wave period visualization

## Technical Specifications

### **Data Range**
- **Server Range**: -1.396 to 29.32 seconds
- **Display Range**: 0 to 29.32 seconds (negative values filtered)
- **Typical Values**: 0-25 seconds for wind wave periods

### **Visualization**
- **Color Palette**: Plasma (high contrast, good for period data)
- **Style**: `default-scalar/psu-plasma`
- **Bands**: 200 color bands for smooth gradients

### **Data Availability**
- **Temporal Coverage**: Same as tpeak (limited dates)
- **Spatial Coverage**: Cook Islands forecast domain
- **Server**: `https://gem-ncwms-hpc.spc.int/ncWMS/wms`

## Variable Comparison

| Variable | Label | Range | Palette | Purpose |
|----------|-------|-------|---------|---------|
| `tpeak` | Peak Wave Period | 9.985-13.68s | YlGnBu | Spectral peak analysis |
| `tp_p1` | Wind Wave Period | 0-29.32s | Plasma | Wind-generated wave periods |
| `tm02` | Mean Wave Period | 0-20s | Spectral | Overall wave period |

## Usage

Users can now select "🌊 Wind Wave Period" from the layer selector to visualize wind-generated wave periods, providing comprehensive wave period analysis alongside the existing peak and mean period layers.

## Benefits

1. **Complete Wave Analysis**: Users can now analyze all wave period components
2. **Wind Wave Focus**: Specific visualization of locally generated wind waves
3. **Consistent Interface**: Matches Widget 1 functionality
4. **Professional Visualization**: Uses optimized color schemes and ranges