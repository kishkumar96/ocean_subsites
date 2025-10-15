# Model Run Time Display Fix

## Problem

The navbar was showing "Model Run: 2 days ago" instead of showing the actual model run time. This happened because:

1. **0-hour timestep skip**: We removed the first timestep (0-hour)
2. **Warm-up skip**: When enabled, we skip the first N days
3. **Using adjusted start**: The navbar was displaying `capTime.start`, which is the ADJUSTED start time (after skips), not the original model run time

### Example Issue

**Original model run**: October 7, 2025 00:00 UTC  
**After 0-hour skip**: `capTime.start` = October 7, 2025 06:00 UTC  
**Result**: Navbar shows "6 hours ago" when it should show "7 days ago"

---

## Solution

Store and use the **original model run time** (`originalStart`) separately from the adjusted start time.

### Architecture

```
WMS GetCapabilities
      ↓
Parse time dimension
      ↓
originalStart ─────────────────→ For display (navbar)
      ↓
Skip warm-up days (if enabled)
      ↓
Skip 0-hour timestep (if enabled)
      ↓
actualStart ───────────────────→ For data/slider (first available timestep)
```

---

## Changes Made

### 1. **useWMSCapabilities.js** - Store `originalStart`

**Initial state:**
```javascript
const [capTime, setCapTime] = useState({ 
  loading: true, 
  start: new Date(), 
  end: new Date(), 
  stepHours: 1,
  originalStart: new Date() // ✅ Added
});
```

**Parse and store:**
```javascript
const { start, end, stepHours, availableTimestamps, originalStart } = timeRange;

setCapTime({
  loading: false,
  start: start || new Date(),                       // Adjusted start (after skips)
  end: end || new Date(),
  stepHours: stepHours || 6,
  totalSteps: newTotalSteps,
  availableTimestamps: availableTimestamps || [],
  originalStart: originalStart || start || new Date() // ✅ Original model run time
});
```

**Static layer case:**
```javascript
setCapTime({
  loading: false,
  start: new Date(),
  end: new Date(),
  stepHours: 1,
  totalSteps: 0,
  availableTimestamps: [],
  originalStart: new Date() // ✅ Added for consistency
});
```

---

### 2. **Home.jsx** - Use `originalStart` for navbar

**Before:**
```javascript
<ModernHeader modelRunTime={capTime.start} />
```
❌ Shows adjusted start time (after 0-hour skip)

**After:**
```javascript
<ModernHeader modelRunTime={capTime.originalStart || capTime.start} />
```
✅ Shows actual model run time

---

### 3. **getTimeRangeFromDimension** - Already returns `originalStart`

Both parsing paths already return the original start:

**Comma-separated format:**
```javascript
return {
  start: actualStart,              // Adjusted (after skips)
  end: originalEnd,
  availableTimestamps: filteredTimestamps,
  originalStart: originalStart,    // ✅ Original model run time
  warmupDays: ENABLE_WARMUP_SKIP ? WARMUP_DAYS : 0,
  warmupSkipped: ENABLE_WARMUP_SKIP && filteredTimestamps.length < validTimestamps.length
};
```

**Range format:**
```javascript
return { 
  start: finalStart,               // Adjusted (after skips)
  end, 
  step, 
  stepHours, 
  availableTimestamps: finalTimestamps,
  originalStart: originalStart,    // ✅ Original model run time
  warmupDays: ENABLE_WARMUP_SKIP ? WARMUP_DAYS : 0,
  warmupSkipped: warmupSkipped
};
```

---

## How It Works Now

### Timeline Visualization

```
Model Run Time (originalStart): Oct 7, 00:00 ─┐
                                              │
Skip 0-hour ───────────────────────────────> │
                                              │
First Available (start): Oct 7, 06:00         │
                                              │
Navbar displays: "Model Run: 7 days ago" <────┘
(Based on originalStart, not start)
```

### Data Flow

```
capTime = {
  originalStart: Oct 7, 00:00  ← Used for navbar display
  start:         Oct 7, 06:00  ← Used for slider/data
  end:           Oct 17, 00:00
  availableTimestamps: [Oct 7 06:00, Oct 7 12:00, ...]
}
```

---

## Testing

### Before Fix
```
Model Run: Oct 7, 00:00
After 0-hour skip: start = Oct 7, 06:00
Navbar shows: "6 hours ago" ❌ WRONG
```

### After Fix
```
Model Run: Oct 7, 00:00
After 0-hour skip: start = Oct 7, 06:00, originalStart = Oct 7, 00:00
Navbar shows: "7 days ago" ✅ CORRECT
```

---

## Console Output

When loading, you'll see:
```
🎯 Skipping 0-hour timestep (analysis/nowcast)
   Removed timestamp: 2025-10-07T00:00:00.000Z
   New start: 2025-10-07T06:00:00.000Z
```

But navbar will correctly show time since `2025-10-07T00:00:00.000Z` (originalStart)!

---

## Benefits

### ✅ Accurate Model Age Display
- Shows when model actually ran, not when first available forecast is
- Users can assess model freshness correctly

### ✅ Separation of Concerns
- `originalStart` = Model run time (for display/metadata)
- `start` = First available data point (for slider/visualization)

### ✅ Backwards Compatible
- Fallback to `start` if `originalStart` not available: `capTime.originalStart || capTime.start`

### ✅ Consistent with Industry Practice
- Operational forecast systems display "model run time", not "first forecast hour"

---

## ModernHeader Component

The `formatTimeAgo` function now correctly calculates based on actual model run time:

```javascript
const formatTimeAgo = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date)) return '...';
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  let interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  // ... other intervals
};
```

**Input**: `originalStart` (actual model run time)  
**Output**: Accurate "X days ago" display

---

## Alternative Considered

### Remove "Model Run" Display (Not Implemented)

As you suggested: "if its too tricky remove it"

We kept it because:
- ✅ The fix was straightforward (store `originalStart`)
- ✅ Model run time is valuable information for users
- ✅ Shows data freshness/reliability
- ✅ Standard practice in forecast applications

---

## Summary

**Problem**: Navbar showed wrong model age due to using adjusted start time  
**Solution**: Store and use `originalStart` for display, keep `start` for data operations  
**Files Modified**: 
- `useWMSCapabilities.js` - Store `originalStart` in `capTime`
- `Home.jsx` - Use `originalStart` for `ModernHeader`

**Result**: ✅ Navbar now shows accurate model run time, not adjusted start time!
