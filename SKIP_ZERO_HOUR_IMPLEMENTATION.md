# Skip 0-Hour Timestep Implementation

## Summary

Implemented feature to **skip the first timestep (0-hour)** from the time slider and default to the **first forecast hour** instead.

---

## Rationale

### Why Skip 0-Hour?

The 0-hour timestep in marine forecast models is typically:
- **Analysis** or **Nowcast**: Current state, not a forecast
- **Model initialization**: May contain assimilated observations rather than pure model predictions
- **Less useful for planning**: Users want to see future forecasts, not current conditions

### Industry Practice

Many operational forecast systems:
- ✅ Display forecasts starting from T+1h or T+6h
- ✅ Separate "current conditions" from "forecast" views
- ✅ Focus on actionable future predictions

---

## Implementation Details

### 1. Configuration (`marineVariables.js`)

**Added new settings:**
```javascript
export const MARINE_CONFIG = {
  // First timestep configuration
  SKIP_FIRST_TIMESTEP: true,  // Skip the 0-hour forecast (often analysis/nowcast, not forecast)
  
  // Slider initialization configuration
  DEFAULT_SLIDER_INDEX: 1,    // Start at index 1 (first forecast timestep after skipping 0-hour)
  
  // ... rest of config
};
```

**Changes:**
- `SKIP_FIRST_TIMESTEP: true` - Enable/disable 0-hour skip
- `DEFAULT_SLIDER_INDEX: 2` → `1` - Now index 1 is the first available timestep

---

### 2. Timestamp Filtering (`useWMSCapabilities.js`)

**Added skip logic for comma-separated timestamps:**
```javascript
// After warm-up filtering...

// ✅ Skip first timestep (0-hour) if enabled
if (MARINE_CONFIG.SKIP_FIRST_TIMESTEP && filteredTimestamps.length > 1) {
  console.log(`🎯 Skipping 0-hour timestep (analysis/nowcast)`);
  console.log(`   Removed timestamp: ${filteredTimestamps[0].toISOString()}`);
  filteredTimestamps = filteredTimestamps.slice(1); // Remove first timestamp
  actualStart = filteredTimestamps[0];
  console.log(`   New start: ${actualStart.toISOString()}`);
}
```

**Added skip logic for range format (start/end/step):**
```javascript
// After generating all timestamps...

let finalTimestamps = availableTimestamps;
let finalStart = actualStart;

if (MARINE_CONFIG.SKIP_FIRST_TIMESTEP && availableTimestamps.length > 1) {
  console.log(`🎯 Skipping 0-hour timestep (analysis/nowcast)`);
  console.log(`   Removed timestamp: ${availableTimestamps[0].toISOString()}`);
  finalTimestamps = availableTimestamps.slice(1);
  finalStart = finalTimestamps[0];
  console.log(`   New start: ${finalStart.toISOString()}`);
}

return { 
  start: finalStart,
  availableTimestamps: finalTimestamps,
  // ...
};
```

---

## Behavior Changes

### Before (with 0-hour)

**Model run**: October 7, 2025 00:00 UTC  
**Available timesteps**:
```
Index 0: Oct 7, 00:00  ← 0-hour (analysis/nowcast)
Index 1: Oct 7, 06:00  ← +6h forecast
Index 2: Oct 7, 12:00  ← +12h forecast
Index 3: Oct 7, 18:00  ← +18h forecast
...
```

**Default slider position**: Index 2 (Oct 7, 12:00)

---

### After (skipping 0-hour)

**Model run**: October 7, 2025 00:00 UTC  
**Available timesteps**:
```
Index 0: Oct 7, 06:00  ← +6h forecast (NEW FIRST STEP)
Index 1: Oct 7, 12:00  ← +12h forecast (DEFAULT)
Index 2: Oct 7, 18:00  ← +18h forecast
Index 3: Oct 8, 00:00  ← +24h forecast
...
```

**Default slider position**: Index 1 (Oct 7, 12:00)  
- Same actual time, but different index!

---

## Timeline Comparison

### Without Skip (Previous)
```
Time:  00:00  06:00  12:00  18:00  00:00  06:00
Index:   0      1      2      3      4      5
Type:  [NOW]  [ Forecast -------------------->]
```

### With Skip (Current)
```
Time:         06:00  12:00  18:00  00:00  06:00
Index:          0      1      2      3      4
Type:        [ Forecast -------------------->]
```

**Result**: Slider only shows forecast timesteps, not nowcast!

---

## Console Output

When loading capabilities, you'll see:
```
🌊 Generated 50 available timestamps
🎯 Skipping 0-hour timestep (analysis/nowcast)
   Removed timestamp: 2025-10-07T00:00:00.000Z
   New start: 2025-10-07T06:00:00.000Z
```

---

## Configuration Options

You can easily control this behavior:

```javascript
// Enable 0-hour skip (current setting)
SKIP_FIRST_TIMESTEP: true,
DEFAULT_SLIDER_INDEX: 1,

// Disable 0-hour skip (show all timesteps including 0-hour)
SKIP_FIRST_TIMESTEP: false,
DEFAULT_SLIDER_INDEX: 2,
```

---

## Safety Features

### Edge Case Handling

1. **Only skips if > 1 timestamp exists**:
   ```javascript
   if (MARINE_CONFIG.SKIP_FIRST_TIMESTEP && filteredTimestamps.length > 1) {
   ```
   - Prevents removing the only available timestamp
   
2. **Updates start time correctly**:
   ```javascript
   actualStart = filteredTimestamps[0];
   ```
   - Ensures time range reflects actual available data

3. **Preserves originalStart**:
   ```javascript
   originalStart: originalStart, // Keep for reference
   ```
   - Can always reference true model start time

---

## User Experience Impact

### ✅ Benefits

1. **Cleaner forecast view**: Only future predictions shown
2. **Better default**: Starts at meaningful forecast hour
3. **Professional appearance**: Matches operational forecast systems
4. **Less confusion**: No mixing of "now" with "future"

### ⚠️ Considerations

1. **Historical comparison**: Can't compare 0-hour to observations easily
2. **Validation workflows**: Some users may want to see nowcast for verification
3. **Documentation needed**: Users should understand why 0-hour is missing

---

## Alternative Approaches Considered

### 1. **Label 0-hour differently** (Not implemented)
```
00:00 (NOW)  06:00  12:00  18:00
```
- **Pros**: Shows all data, clear distinction
- **Cons**: More complex UI, still mixes nowcast with forecast

### 2. **Separate "Current" tab** (Not implemented)
```
[Current Conditions] [Forecast]
```
- **Pros**: Clean separation
- **Cons**: More complex architecture

### 3. **Skip in slider only** (Current approach) ✅
```
// Just remove from available timestamps
```
- **Pros**: Simple, effective, configurable
- **Cons**: Data still exists on server, just not shown

---

## Testing Checklist

- ✅ **Slider range**: Should start at +6h, not 0h
- ✅ **Default position**: Should show index 1 (which is now +12h)
- ✅ **Console logs**: Should show "Skipping 0-hour timestep"
- ✅ **WMS requests**: Should request T+6h minimum, not T+0h
- ✅ **Total steps**: Should be N-1 (one fewer than original)
- ✅ **Edge case**: Single timestamp should not be removed

---

## Summary

**Change**: Skip first timestep (0-hour) from time slider  
**Reason**: 0-hour is analysis/nowcast, not forecast  
**Impact**: Cleaner forecast view, better default position  
**Config**: `SKIP_FIRST_TIMESTEP: true`, `DEFAULT_SLIDER_INDEX: 1`  
**Files Modified**: 
- `marineVariables.js` - Added configuration
- `useWMSCapabilities.js` - Implemented skip logic (2 places)

**Status**: ✅ Complete and tested for both comma-separated and range-format timestamps
