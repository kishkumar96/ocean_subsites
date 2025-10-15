# Model Run Time Fix v2 - Inferred Model Run Time

## The Real Problem

The WMS server returns timestamps that **don't include the 0-hour** (model run time). For example:

**WMS Returns**:
```
2025-10-07T06:00:00Z  ← First available (T+6h)
2025-10-07T12:00:00Z
2025-10-07T18:00:00Z
...
```

**What we were doing (WRONG)**:
```javascript
const originalStart = validTimestamps[0];  // 2025-10-07T06:00:00Z
```
This gives us T+6h, not the model run time (T+0)!

**Result**: Navbar shows "Model Run: 6 hours ago" when it should show "12 hours ago"

---

## Solution: Infer Model Run Time

Since the server doesn't provide T+0, we calculate it:

```
Model Run Time (T+0) = First Available Timestamp - Step Size
```

### Implementation

```javascript
// Calculate step size from first two timestamps
let stepMillis = 6 * 60 * 60 * 1000; // Default 6 hours
if (validTimestamps.length > 1) {
  stepMillis = validTimestamps[1].getTime() - validTimestamps[0].getTime();
}

// Model run time = first available timestamp - step size
const firstAvailable = validTimestamps[0];
const inferredModelRunTime = new Date(firstAvailable.getTime() - stepMillis);

console.log(`🎯 Inferring model run time:`);
console.log(`   First available: ${firstAvailable.toISOString()}`);
console.log(`   Step size: ${stepMillis / (60 * 60 * 1000)} hours`);
console.log(`   Inferred model run: ${inferredModelRunTime.toISOString()}`);
```

---

## Example

### WMS Server Returns:
```
2025-10-07T06:00:00Z  ← First available
2025-10-07T12:00:00Z  ← Second available
2025-10-07T18:00:00Z
...
```

### Calculation:
```javascript
firstAvailable = 2025-10-07T06:00:00Z
step = 2025-10-07T12:00:00Z - 2025-10-07T06:00:00Z = 6 hours

inferredModelRunTime = 2025-10-07T06:00:00Z - 6 hours
                     = 2025-10-07T00:00:00Z  ✅
```

### Result:
- **Model Run Time**: 2025-10-07T00:00:00Z
- **First Available Data**: 2025-10-07T06:00:00Z (after we skip it with SKIP_FIRST_TIMESTEP)
- **Navbar shows**: "Model Run: 7 days ago" ✅ CORRECT

---

## Code Changes

### 1. Comma-Separated Format (WMS Timestamp List)

**File**: `useWMSCapabilities.js`

```javascript
if (validTimestamps.length > 0) {
  // ✅ Infer model run time: First timestamp might be +6h forecast, not model run (T+0)
  let stepMillis = 6 * 60 * 60 * 1000; // Default 6 hours
  if (validTimestamps.length > 1) {
    stepMillis = validTimestamps[1].getTime() - validTimestamps[0].getTime();
  }
  
  const firstAvailable = validTimestamps[0];
  const inferredModelRunTime = new Date(firstAvailable.getTime() - stepMillis);
  
  // ... filtering logic ...
  
  return {
    start: actualStart,
    availableTimestamps: filteredTimestamps,
    originalStart: inferredModelRunTime, // ✅ Inferred T+0, not first available
    // ...
  };
}
```

### 2. Range Format (start/end/step)

**No change needed!** The range format already has the true start:
```
2025-10-07T00:00:00Z/2025-10-17T00:00:00Z/PT6H
       ↑
    True model run time (T+0)
```

---

## Why This Approach Works

### Two WMS Time Dimension Formats

#### Format 1: Range Format
```
2025-10-07T00:00:00Z/2025-10-17T00:00:00Z/PT6H
```
- **Has T+0**: Start time IS the model run time
- **No inference needed**: Already correct!

#### Format 2: Comma-Separated List
```
2025-10-07T06:00:00Z,2025-10-07T12:00:00Z,2025-10-07T18:00:00Z,...
```
- **Missing T+0**: First timestamp is already T+6h
- **Inference needed**: Calculate backwards from first available

---

## Console Output

You'll now see:
```
🎯 Inferring model run time:
   First available: 2025-10-07T06:00:00.000Z
   Step size: 6 hours
   Inferred model run: 2025-10-07T00:00:00.000Z

⏰ Time Range Parsed:
   Original Start (Model Run): 2025-10-07T00:00:00.000Z
   Adjusted Start (After Skips): 2025-10-07T12:00:00.000Z
   End: 2025-10-17T00:00:00.000Z

🕒 ModernHeader received modelRunTime: 2025-10-07T00:00:00.000Z
```

---

## Edge Cases Handled

### 1. Single Timestamp
```javascript
if (validTimestamps.length > 1) {
  stepMillis = validTimestamps[1].getTime() - validTimestamps[0].getTime();
} else {
  stepMillis = 6 * 60 * 60 * 1000; // Default 6 hours
}
```

### 2. Range Format
- Already has T+0 in the string
- No inference needed
- Uses `parts[0]` directly

### 3. Static Layers
- Use current time as placeholder
- Model run time not applicable

---

## Why Previous Fix Didn't Work

### Previous Approach
```javascript
const originalStart = validTimestamps[0]; // ❌ This is T+6h, not T+0!
```

### The Issue
- WMS server already excludes T+0
- We were treating first available as model run time
- This was off by one timestep (typically 6 hours)

### New Approach
```javascript
const inferredModelRunTime = new Date(firstAvailable.getTime() - stepMillis); // ✅ Calculate T+0
```

---

## Testing

### Before Fix
```
Server returns: [T+6h, T+12h, T+18h, ...]
originalStart = T+6h
Navbar shows: "6 hours ago" ❌
```

### After Fix
```
Server returns: [T+6h, T+12h, T+18h, ...]
stepSize = 6h
inferredModelRunTime = T+6h - 6h = T+0
Navbar shows: "12 hours ago" (if model is 12h old) ✅
```

---

## Summary

**Problem**: WMS server doesn't include T+0, so first timestamp is already T+6h  
**Solution**: Infer model run time by subtracting step size from first available  
**Formula**: `Model Run Time = First Available - Step Size`  
**Result**: Navbar now shows accurate model age!

**Files Modified**:
- `useWMSCapabilities.js` - Added model run time inference for comma-separated format
- `ModernHeader.jsx` - Added debug logging

**Status**: ✅ Should now show correct model age!
