# REDUNDANCY CLEANUP PLAN FOR WIDGET5

## IMMEDIATE ACTIONS (High Priority)

### 1. Remove Duplicate useMapStatePersistence Files
- ✅ Keep: `/src/hooks/useMapStatePersistence.js` (most complete)
- ❌ Delete: `/src/pages/useMapStatePersistence.js` (empty)
- ❌ Delete: `/src/components/useMapStatePersistence.js` (redundant)

### 2. Remove Unused Components
- ❌ Delete: `COGComparison.jsx` (0 imports)
- ❌ Delete: `DebugControls.jsx` (0 imports)
- ❌ Delete: `ExampleButtons.jsx` (0 imports)
- ❌ Keep: `TokenError.jsx` (may be used for error handling)
- ❌ Keep: `ThemeToggle.jsx` (future use)

### 3. Consolidate Color Management
- ✅ Keep: `DynamicColorManager.js` (most advanced Viridis system)
- ❌ Deprecate: `ColorManager.js` (basic system, migrate functions)
- ✅ Keep: `WMSStyleManager.js` (WMS-specific styling)
- ⚠️ Review: `MLColorAdaptationSystem.js` (if ML features are used)

## MEDIUM PRIORITY ACTIONS

### 4. CSS Consolidation
- ✅ Keep: `ForecastApp.css` (main styles)
- ✅ Merge: `ResponsiveMapLayout.css` into `ForecastApp.css`
- ⚠️ Review: Remove duplicate media queries

### 5. Utility Consolidation
- ✅ Keep: `DynamicVisualizationManager.js` (main system)
- ⚠️ Review: `IntelligentVisualizationSystem.js` (check if features used)
- ✅ Keep: `WMSMetadataClient.js` (core WMS functionality)

## FILES TO DELETE IMMEDIATELY
1. `/src/pages/useMapStatePersistence.js`
2. `/src/components/useMapStatePersistence.js`
3. `/src/components/COGComparison.jsx`
4. `/src/components/DebugControls.jsx`
5. `/src/components/ExampleButtons.jsx`

## IMPORT CLEANUP NEEDED
- Remove commented imports in `Home.jsx`
- Update imports from deleted files
- Consolidate color manager imports

## ESTIMATED REDUCTION
- **Files**: -5 files (-10%)
- **Code**: ~300-400 lines
- **Bundle Size**: ~15-20KB reduction
- **Maintenance**: Significantly simplified

## RISK ASSESSMENT
- **Low Risk**: File deletions (unused components)
- **Medium Risk**: CSS consolidation (test all breakpoints)
- **High Risk**: Color system changes (test all visualizations)