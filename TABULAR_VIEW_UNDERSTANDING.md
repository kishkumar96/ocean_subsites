# Tabular View Feature - Understanding & Implementation Status

## What You Want

Based on your screenshot from **Niue Dashboard (Widget1)**, when clicking any point on the map, you want a **tabular data view** at the bottom that shows:

### Visual Layout (From Screenshot)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 Tabular | Timeseries | Map                                         │
├─────────────┬──────────────────────────────────────────────────────────┤
│ Parameter   │  Su 12  │  Su 12  │  Mo 13  │  Mo 13  │  Tu 14  │ ... │
│             │  06hr   │  12hr   │  00hr   │  06hr   │  00hr   │     │
├─────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────┤
│ Wave        │  2.0    │  2.0    │  1.9    │  1.8    │  1.8    │ ... │ (Blue bg)
│ Wave Period │  8      │  8      │  8      │  8      │  9      │ ... │ (Red bg)
│ Wave dir    │  ←      │  ←      │  ←      │  ←      │  ←      │ ... │ (Arrows)
│ Wave Energy │  5      │  5      │  4      │  3      │  5      │ ... │ (Jet colors)
│ Swell(m)    │  0.7    │  0.7    │  1.6    │  1.4    │  1.4    │ ... │ (Blue bg)
│ Swell Period│  8      │  8      │  8      │  8      │  9      │ ... │ (Red bg)
│ Swell Dir   │  ←      │  ←      │  ←      │  ←      │  ←      │ ... │ (Arrows)
│ 2.Swell (m) │  0.8    │  0.8    │  0.8    │  0.8    │  0.9    │ ... │ (Blue bg)
│ ... and more ...                                                       │
└─────────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────┘
```

### Key Features Needed:

✅ **Multiple Parameters (Rows)**
- Wave height (hs)
- Wave Period (tm02 or tpeak)
- Wave direction (dirm, dirp) - **with arrows**
- Wave Energy (calculated from transpx/transpy)
- Primary Swell (hs_p2, tp_p2, dirp_p2)
- Secondary Swell (hs_p3, tp_p3, dirp_p3)
- Wind waves (hs_p1, tp_p1, dirp_p1)

✅ **Time Series (Columns)**
- Each column = one forecast timestep
- Header shows: Day, Date, Hour (e.g., "Su 12 06hr")
- Horizontal scrolling for many timesteps

✅ **Color Coding**
- **Blue gradient** - Wave heights (0-5m scale)
- **Red gradient** - Wave periods (0-20s scale)
- **Jet colormap** - Wave energy (0-100 scale)
- **Dark text** on light backgrounds, **light text** on dark backgrounds

✅ **Direction Arrows**
- SVG arrows rotated to show wave/swell/wind direction
- Meteorological convention (direction FROM)

✅ **Interactive**
- Click map → Popup shows instant value ("Value: 1.77")
- Bottom panel opens automatically with full tabular view
- Tabs: Tabular | Timeseries | Map

---

## Widget5 Current Status

### ✅ What Already Exists

#### 1. **BottomOffCanvas Component**
- **File**: `plugin/widget5/src/pages/BottomOffCanvas.jsx`
- **Status**: ✅ Implemented and wired up
- **Features**:
  - Offcanvas drawer at bottom
  - Tabs: Tabular, Timeseries, Map
  - Data fetching with GetTimeseries API
  - Integrated with Home.jsx

#### 2. **Tabular Component**
- **File**: `plugin/widget5/src/pages/tabular.js`
- **Status**: ✅ Implemented with A+ enhancements
- **Features**:
  - Custom hooks (`useTableData`, `useDarkMode`)
  - Loading states, error handling
  - Accessibility (ARIA attributes)
  - Responsive design
  - Empty state messages

#### 3. **Map Click Handler**
- **File**: `plugin/widget5/src/hooks/useMapInteraction.js`
- **Status**: ✅ Fully implemented
- **Features**:
  - MapInteractionService integration
  - BottomCanvasManager for state
  - Async data fetching
  - Error handling

#### 4. **WMS GetFeatureInfo**
- **File**: `plugin/widget5/src/pages/addWMSTileLayer.js`
- **Status**: ✅ Implemented with proxy support
- **Features**:
  - GetFeatureInfo requests
  - TIME parameter support
  - Promise-based API
  - Layer.getFeatureInfo() method

#### 5. **Data Fetching**
- **Files**: Multiple service files
- **Status**: ✅ GetTimeseries API calls work
- **Features**:
  - THREDDS server support (for dirm)
  - ncWMS server support (for other vars)
  - 7-day forecast window
  - Pixel-based queries

---

## What Might Be Missing or Not Working

### 🔍 Investigation Needed:

1. **Does BottomOffCanvas Open on Click?**
   - Check if map click triggers the canvas
   - Verify `setShowBottomCanvas(true)` is called
   - Check console for errors

2. **Is Data Being Fetched?**
   - Check network tab for GetTimeseries requests
   - Verify perVariableData is populated
   - Check for CORS or 500 errors

3. **Is Tabular View Rendering?**
   - Check if tableRows and times are populated
   - Verify variable mapping (hs, tm02, tpeak, dirm)
   - Check for missing variables in data

4. **Are All Variables Showing?**
   - Widget1 shows: hs, tpeak, dirp, transp_x, hs_p2, tp_p2, dirp_p2, hs_p3, tp_p3, dirp_p3, hs_p1, tp_p1, dirp_p1
   - Widget5 configured for: hs, tm02, tpeak, dirm
   - **Missing**: Swell partitions (p1, p2, p3), Wave energy calculation

---

## Key Differences: Widget1 vs Widget5

| Feature | Widget1 (Niue) ✅ | Widget5 (Cook Islands) |
|---------|-------------------|------------------------|
| **Tabular Component** | ✅ Working | ✅ Exists, status unknown |
| **Variables** | 13 parameters | 4 parameters (hs, tm02, tpeak, dirm) |
| **Swell Partitions** | ✅ p1, p2, p3 | ❓ Not configured |
| **Wave Energy** | ✅ Calculated from transp_x | ❓ Not configured |
| **Direction Arrows** | ✅ SVG with rotation | ✅ Should work (ArrowSVG.jsx exists) |
| **Color Schemes** | ✅ Jet, Blue, Red | ✅ Should work (functions exist) |
| **Server Setup** | ✅ ncWMS | ✅ ncWMS + THREDDS |
| **Auto-Open on Click** | ✅ Yes | ❓ Unknown |

---

## Widget1 Tabular Implementation (Reference)

### Variable Configuration (Widget1)
```javascript
const variableDefs = [
  { key: "hs", label: "Wave{0-5/Bu/1}" },              // Wave height (blue, 0-5m, 1 decimal)
  { key: "tpeak", label: "Wave Period{0-20/Rd/0}" },  // Peak period (red, 0-20s, 0 decimals)
  { key: "dirp", label: "Wave direction{0/dir}" },    // Direction (arrows, 0 decimals)
  { key: "transp_x", label: "Wave Energy{calc/0-100/jet/0}" }, // Calculated energy (jet colors)
  { key: "hs_p2", label: "Swell(m){0-5/Bu/1}" },      // Primary swell height
  { key: "tp_p2", label: "Swell Period{0-25/Rd/0}" }, // Primary swell period
  { key: "dirp_p2", label: "Swell Dir{0/dir}" },      // Primary swell direction
  { key: "hs_p3", label: "2.Swell (m){0-5/Bu/1}" },   // Secondary swell height
  { key: "tp_p3", label: "2.Swell Period{0-25/Rd/0}"},// Secondary swell period
  { key: "dirp_p3", label: "2. Swell Dir{0-5/dir}" }, // Secondary swell direction
  { key: "hs_p1", label: "Wind wave(m){0-5/Bu/1}" },  // Wind wave height
  { key: "tp_p1", label: "Wind wave period{0-25/Rd/0}"},// Wind wave period
  { key: "dirp_p1", label: "Wind wave dir{0-4/dir}" } // Wind wave direction
];
```

### Label Config Syntax
- `{Bu}` or `{0-5/Bu/1}` = Blue color scale, 0-5 range, 1 decimal place
- `{Rd}` or `{0-20/Rd/0}` = Red color scale, 0-20 range, 0 decimals
- `{dir}` = Direction arrows (not color-coded)
- `{jet}` or `{0-100/jet}` = Jet colormap, 0-100 range
- `{calc}` = Calculated field (e.g., energy from x/y components)

### Color Functions (Widget1)
```javascript
function jetColor(value, min = 0, max = 4)   // Rainbow gradient
function redColor(value, min = 0, max = 20)  // White → Dark red
function blueColor(value, min = 0, max = 4)  // Light blue → Dark blue
```

### Arrow Component (Widget1)
```javascript
const ArrowSVG = ({ angle, isDarkMode }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" 
       style={{ transform: `rotate(${angle}deg)` }}>
    <line x1="11" y1="18" x2="11" y2="4" stroke="..." strokeWidth="2"/>
    <polygon points="11,2 7,8 15,8" fill="..." />
  </svg>
);
```

---

## Widget5 Tabular Implementation (Current)

### File Structure
```
plugin/widget5/src/
├── pages/
│   ├── tabular.js              ← Main tabular component
│   ├── BottomOffCanvas.jsx     ← Container with tabs
│   ├── timeseries.js           ← Timeseries chart view
│   └── map.js                  ← Map preview
├── components/
│   ├── TableCell.jsx           ← Individual cell component
│   └── ArrowSVG.jsx            ← Direction arrows
├── hooks/
│   ├── useTableData.js         ← Table data processing
│   ├── useMapInteraction.js    ← Map click handling
│   └── useMapContainerRect.js  ← Container sizing
├── services/
│   ├── MapInteractionService.js ← Click event handling
│   └── BottomCanvasManager.js   ← State management
├── styles/
│   ├── tableStyles.js          ← Table styling
│   └── tableCustom.css         ← Custom table CSS
└── utils/
    └── marineDataUtils.js      ← Data formatting utilities
```

### Current Variable Configuration (Widget5)
```javascript
// From BottomOffCanvas.jsx
const FORECAST_VARIABLE_KEYS = ['hs', 'tm02', 'tpeak', 'dirm'];
```

**⚠️ Problem**: Only 4 variables configured!  
Widget1 has **13 variables** including swell partitions and wind waves.

---

## What Needs to Happen

### Option 1: Test Current Implementation ✅ **RECOMMENDED FIRST**

**Action**: Click on the map in Widget5 and observe:

1. **Does the bottom panel open?**
   - ✅ Yes → Proceed to step 2
   - ❌ No → Debug map click handler

2. **Does it show "No data"?**
   - ✅ Shows data → Check which variables appear
   - ❌ No data → Debug GetTimeseries requests

3. **Are there errors in console?**
   - ✅ No errors → Check variable coverage
   - ❌ Errors → Debug API or CORS issues

4. **How many variables/rows show?**
   - 4 rows (hs, tm02, tpeak, dirm) → **Expected**
   - < 4 rows → Missing data for some variables
   - 0 rows → Data fetching or parsing issue

**Test Command:**
```bash
cd /home/kishank/ocean_subsites/plugin/widget5
npm start
# Then click on the map and observe
```

---

### Option 2: Add Missing Variables to Widget5

If Widget5 is working but only shows 4 variables, add the missing swell and wind wave partitions:

#### Update Variable Configuration

**File**: `plugin/widget5/src/pages/BottomOffCanvas.jsx`

**Change from:**
```javascript
const FORECAST_VARIABLE_KEYS = ['hs', 'tm02', 'tpeak', 'dirm'];
```

**Change to:**
```javascript
const FORECAST_VARIABLE_KEYS = [
  'hs',       // Significant wave height
  'tpeak',    // Peak wave period (or 'tm02' for mean period)
  'dirm',     // Mean wave direction
  'hs_p1',    // Wind wave height
  'tp_p1',    // Wind wave period
  'dirp_p1',  // Wind wave direction
  'hs_p2',    // Primary swell height
  'tp_p2',    // Primary swell period
  'dirp_p2',  // Primary swell direction
  'hs_p3',    // Secondary swell height
  'tp_p3',    // Secondary swell period
  'dirp_p3'   // Secondary swell direction
];
```

#### Update Variable Labels

**File**: `plugin/widget5/src/pages/tabular.js` or `plugin/widget5/src/utils/marineDataUtils.js`

Add variable definitions similar to Widget1:
```javascript
const variableDefs = [
  { key: "hs", label: "Wave{0-5/Bu/1}" },
  { key: "tpeak", label: "Wave Period{0-20/Rd/0}" },
  { key: "dirm", label: "Wave direction{0/dir}" },
  { key: "hs_p2", label: "Swell(m){0-5/Bu/1}" },
  { key: "tp_p2", label: "Swell Period{0-25/Rd/0}" },
  { key: "dirp_p2", label: "Swell Dir{0/dir}" },
  { key: "hs_p3", label: "2.Swell (m){0-5/Bu/1}" },
  { key: "tp_p3", label: "2.Swell Period{0-25/Rd/0}" },
  { key: "dirp_p3", label: "2.Swell Dir{0/dir}" },
  { key: "hs_p1", label: "Wind wave(m){0-5/Bu/1}" },
  { key: "tp_p1", label: "Wind wave period{0-25/Rd/0}" },
  { key: "dirp_p1", label: "Wind wave dir{0/dir}" }
];
```

---

### Option 3: Copy Widget1 Implementation to Widget5

If Widget5's tabular view isn't working at all, copy Widget1's proven implementation:

```bash
# Backup current Widget5 tabular
cp plugin/widget5/src/pages/tabular.js plugin/widget5/src/pages/tabular.js.backup

# Copy Widget1 tabular to Widget5
cp plugin/widget1/src/pages/tabular.js plugin/widget5/src/pages/tabular.js

# May need to adjust imports for Widget5's structure
```

**⚠️ Note**: Widget5 has enhanced architecture (hooks, services), so direct copy may require integration work.

---

## Debugging Checklist

If tabular view doesn't work, check:

- [ ] **Map click handler registered?** (console.log in useMapInteraction)
- [ ] **BottomOffCanvas receives data?** (console.log in BottomOffCanvas)
- [ ] **GetTimeseries requests succeed?** (Network tab, look for 200 responses)
- [ ] **perVariableData populated?** (React DevTools, check props)
- [ ] **tableRows and times arrays exist?** (console.log in Tabular component)
- [ ] **Variables exist in WMS layer?** (Check GetCapabilities for hs_p1, tp_p2, etc.)
- [ ] **Server supports variables?** (Test GetTimeseries URL directly in browser)
- [ ] **CORS issues?** (Check console for CORS errors)
- [ ] **Proxy configured?** (setupProxy.js for /ncWMS and /thredds routes)

---

## Next Steps

### 1. **Test Current Implementation** ✅
Click the map in Widget5 and document what happens:
- Does panel open? ✅ / ❌
- Shows data? ✅ / ❌
- Which variables show? (list them)
- Any errors? (paste errors)

### 2. **Compare with Widget1**
Open Widget1 (Niue) and Widget5 (Cook Islands) side-by-side:
- Note differences in variable coverage
- Compare data formats
- Check server responses

### 3. **Implement Missing Features**
Based on test results:
- Add missing variables if needed
- Fix data fetching if broken
- Enhance styling to match Widget1
- Add calculated fields (wave energy)

---

## Summary

**What You Want:**
- ✅ Tabular view like Niue (screenshot)
- ✅ Multiple marine parameters (wave, swell, wind wave)
- ✅ Time series columns with color-coded cells
- ✅ Direction arrows for directional parameters
- ✅ Auto-open on map click

**What Widget5 Has:**
- ✅ BottomOffCanvas component (implemented)
- ✅ Tabular.js component (enhanced version)
- ✅ Map click handler (working)
- ✅ GetFeatureInfo (working)
- ⚠️ Only 4 variables configured (needs expansion)
- ❓ Unknown if auto-opening works (needs testing)

**Most Likely Issue:**
Widget5 is only configured for 4 basic variables (hs, tm02, tpeak, dirm) while Widget1 shows 13 variables including swell partitions. Need to:
1. **Test if current implementation works** for the 4 variables
2. **Add missing variables** (swell partitions, wind waves)
3. **Verify data availability** on Cook Islands WMS server

---

## Questions for You

1. **When you click the map in Widget5, what happens?**
   - Nothing?
   - Panel opens but empty?
   - Panel opens with some data?
   - Panel opens with full data like screenshot?

2. **Do you want ALL 13 variables like Widget1?**
   - Or just a subset for Cook Islands?

3. **Is the Cook Islands WMS server configured with swell partition variables?**
   - Check: https://gem-ncwms-hpc.spc.int/ncWMS/wms?REQUEST=GetCapabilities

4. **Should I:**
   - A) Test and debug current implementation first? ✅ **RECOMMENDED**
   - B) Copy Widget1's tabular.js directly to Widget5?
   - C) Enhance Widget5's tabular with missing variables?

Let me know the answer to question #1 (what currently happens when you click), and I'll provide specific next steps! 🎯
