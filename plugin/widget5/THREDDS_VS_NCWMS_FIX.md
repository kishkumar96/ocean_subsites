# THREDDS vs ncWMS Server Configuration Fix

## Issue Resolved
The ncWMS server at `https://gem-ncwms-hpc.spc.int/ncWMS/wms` was providing **incorrect wave direction data**. 

## Solution Implemented
Switched wave direction layer to use **THREDDS WMS server** which provides accurate directional data:

**New THREDDS URL:** 
```
https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc
```

## Technical Changes

### Wave Direction Layer Configuration
**File:** `src/utils/WorldClassVisualization.js`

**Before (ncWMS - incorrect directions):**
```javascript
{
  value: "cook_forecast/dirm", 
  wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms"
}
```

**After (THREDDS - correct directions):**
```javascript
{
  value: "dirm", // THREDDS layer name
  wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc"
}
```

### Updated Detection Logic
**File:** `src/hooks/useMapRendering.js`
```javascript
// Updated to match new THREDDS layer name
const isWaveDirectionLayer = layerConfig.value === 'dirm';
```

## Key Differences: THREDDS vs ncWMS

| Aspect | ncWMS | THREDDS |
|--------|-------|---------|
| **Direction Accuracy** | ❌ Incorrect | ✅ Correct |
| **Layer Name Format** | `cook_forecast/dirm` | `dirm` |
| **Data Source** | Processed/cached | Direct from NetCDF |
| **URL Structure** | `/ncWMS/wms` | `/thredds/wms/[file].nc` |

## Impact
- **Marine Navigation**: Now shows accurate wave directions for Cook Islands
- **Safety**: Correct directional information for maritime operations  
- **Reliability**: Direct access to authoritative THREDDS data source
- **Consistency**: Ensures wave direction arrows point in correct compass directions

## Verification
To verify directions are correct:
1. Compare with wind direction patterns
2. Check against regional weather patterns
3. Validate with local marine observations
4. Ensure arrows point FROM wave origin TO wave destination

This fix ensures marine forecasters and navigators receive accurate directional information critical for safety and operational planning.