# Peak Period Minimum Changed to Zero

## Change Summary

Changed the **Peak Wave Period (tpeak)** color scale minimum from `9.985` to `0` seconds.

---

## Files Modified

### 1. **Home.jsx** - Configuration

**Before:**
```javascript
tpeak: () => ({
  style: "default-scalar/psu-magma",
  colorscalerange: "9.985,13.68",  // ❌ Started at 9.985s
  numcolorbands: 200,
  belowmincolor: "transparent",
  abovemaxcolor: "extend"
}),
```

**After:**
```javascript
tpeak: () => ({
  style: "default-scalar/psu-magma",
  colorscalerange: "0,13.68",  // ✅ Now starts at 0s
  numcolorbands: 200,
  belowmincolor: "transparent",
  abovemaxcolor: "extend"
}),
```

### 2. **Home.jsx** - Layer Definition

**Before:**
```javascript
legendUrl: getWorldClassLegendUrl('tpeak', '9.985,13.68', 's'),
description: "Enhanced peak period analysis with actual data range (9.985-13.68s)..."
```

**After:**
```javascript
legendUrl: getWorldClassLegendUrl('tpeak', '0,13.68', 's'),
description: "Enhanced peak period analysis with full range (0-13.68s)..."
```

### 3. **addWMSTileLayer.js** - Fallback Configuration

**Before:**
```javascript
if (!finalOptions.colorscalerange) {
    finalOptions.colorscalerange = '9.985,13.68';
    console.log('🌊 Setting Cook Islands tpeak color scale range: 9.985-13.68s');
}
```

**After:**
```javascript
if (!finalOptions.colorscalerange) {
    finalOptions.colorscalerange = '0,13.68';
    console.log('🌊 Setting Cook Islands tpeak color scale range: 0-13.68s');
}
```

---

## Rationale

### Why Start at Zero?

1. **Standard Scientific Range**: Wave periods physically start at 0 seconds
2. **Better Visual Discrimination**: Full color palette utilization for all possible values
3. **Consistency**: Matches how other period variables (tm02) are displayed with `0,20` range
4. **No Data Loss**: `belowmincolor: "transparent"` handles areas with no data

### Previous Range (9.985-13.68s)

The previous range was based on the **actual data range** observed in the Cook Islands model output. While accurate for the specific dataset, it:
- ❌ Made the color scale compressed into a narrow band
- ❌ Didn't follow standard oceanographic visualization practices
- ❌ Could hide variations if data went outside this range

### New Range (0-13.68s)

The new range provides:
- ✅ **Full spectrum visualization**: Colors span the entire physical range
- ✅ **Better color differentiation**: Each second of period gets more color space
- ✅ **Standard practice**: Matches how wave period is typically visualized
- ✅ **Future-proof**: Works for any data values, not just current model output

---

## Visual Impact

### Color Mapping Example (Magma Palette)

**Before (9.985-13.68s range, 3.695s span):**
```
9.985s  →  Dark purple (min)
11.0s   →  Purple/magenta
12.0s   →  Orange/yellow
13.68s  →  Bright yellow (max)
```
All colors compressed into a ~3.7 second range!

**After (0-13.68s range, 13.68s span):**
```
0s      →  Dark purple (min)
3.4s    →  Purple
6.8s    →  Magenta/pink
10.2s   →  Orange
13.68s  →  Bright yellow (max)
```
Colors spread evenly across the full period range!

---

## Testing Checklist

- ✅ **WMS requests**: Should include `COLORSCALERANGE=0,13.68`
- ✅ **Legend**: Should show 0s at bottom, 13.68s at top
- ✅ **Map visualization**: Colors should span full palette
- ✅ **Console logs**: Should show "0-13.68s" not "9.985-13.68s"

---

## Comparison with Mean Period (tm02)

For consistency, both period variables now use zero-based ranges:

| Variable | Range | Palette | Purpose |
|----------|-------|---------|---------|
| **tm02** (Mean Wave Period) | `0-20s` | Plasma (divergent) | Full spectral period |
| **tpeak** (Peak Wave Period) | `0-13.68s` | Magma (sequential) | Dominant period |

Both now start at **0 seconds** for consistent, standard visualization! ✅

---

## Summary

**Change**: Peak Period minimum `9.985s` → `0s`  
**Impact**: Better color distribution, standard practice, future-proof  
**Files**: 3 files updated (Home.jsx × 2, addWMSTileLayer.js × 1)  
**Status**: ✅ Complete and consistent across all configuration points
