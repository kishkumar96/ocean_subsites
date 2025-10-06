/**
 * Marine Variable Definitions and Configuration
 * Centralized configuration for marine forecast parameters
 */

import { calculateDynamicRange, extractCoverageTimeseries } from '../utils/marineDataUtils.js';

// Marine variable definitions with WMO standards
export const MARINE_VARIABLES = {
  'hs': {
    key: 'hs',
    label: 'Significant Wave Height',
    description: 'The average height of the highest third of waves',
    defaultRange: { min: 0, max: 5 },
    colorScheme: 'viridis',  // Match WMS Viridis palette
    decimalPlaces: 1,
    units: 'm',
    category: 'wave',
    wmoCodes: ['height_of_wind_waves', 'significant_height_of_wind_and_swell_waves']
  },
  'tm02': {
    key: 'tm02', 
    label: 'Mean Wave Period',
    description: 'Mean zero-crossing period of waves',
    defaultRange: { min: 0, max: 20 },
    colorScheme: 'ylgnbu',  // Match WMS YlGnBu palette
    decimalPlaces: 0,
    units: 's',
    category: 'wave',
    wmoCodes: ['mean_period_of_wind_waves']
  },
  'tpeak': {
    key: 'tpeak',
    label: 'Peak Wave Period', 
    description: 'Wave period corresponding to the most energetic waves',
    defaultRange: { min: 0, max: 25 },
    colorScheme: 'magenta',  // Match WMS Magma palette
    decimalPlaces: 0,
    units: 's',
    category: 'wave',
    wmoCodes: ['peak_period_of_wind_waves']
  },
  'dirm': {
    key: 'dirm',
    label: 'Mean Wave Direction',
    description: 'Direction from which waves are coming',
    defaultRange: { min: 0, max: 360 },
    colorScheme: 'dir',
    decimalPlaces: 0,
    units: '°',
    category: 'direction',
    wmoCodes: ['direction_of_wind_waves']
  },
  'ws': {
    key: 'ws',
    label: 'Wind Speed',
    description: '10-meter wind speed',
    defaultRange: { min: 0, max: 25 },
    colorScheme: 'jet',
    decimalPlaces: 1,
    units: 'm/s',
    category: 'wind',
    wmoCodes: ['wind_speed']
  },
  'wd': {
    key: 'wd',
    label: 'Wind Direction',
    description: 'Direction from which wind is blowing',
    defaultRange: { min: 0, max: 360 },
    colorScheme: 'dir',
    decimalPlaces: 0,
    units: '°',
    category: 'direction',
    wmoCodes: ['wind_from_direction']
  },
  'sst': {
    key: 'sst',
    label: 'Sea Surface Temperature',
    description: 'Temperature at the sea surface',
    defaultRange: { min: 20, max: 30 },
    colorScheme: 'rd',
    decimalPlaces: 1,
    units: '°C',
    category: 'temperature',
    wmoCodes: ['sea_surface_temperature']
  }
};

// Get variable definition with dynamic range calculation
export const getVariableDefinition = (key, actualData = null) => {
  const baseDefinition = MARINE_VARIABLES[key] || {
    key,
    label: key.toUpperCase(),
    description: `Marine parameter: ${key}`,
    defaultRange: { min: 0, max: 10 },
    colorScheme: 'bu',
    decimalPlaces: 1,
    units: '',
    category: 'unknown',
    wmoCodes: []
  };

  // Create a copy to avoid mutation
  const definition = { ...baseDefinition };

  // Calculate actual range if data is provided
  if (actualData) {
    const ts = extractCoverageTimeseries(actualData, key);
    if (ts?.values) {
      const actualRange = calculateDynamicRange(
        ts.values, 
        definition.defaultRange.min, 
        definition.defaultRange.max
      );
      definition.actualRange = actualRange;
    }
  }

  return definition;
};

// Get all available marine variables
export const getAllVariableKeys = () => Object.keys(MARINE_VARIABLES);

// Get variables by category
export const getVariablesByCategory = (category) => {
  return Object.values(MARINE_VARIABLES).filter(v => v.category === category);
};

// Validate variable configuration
export const validateVariableConfig = (config) => {
  const required = ['key', 'label', 'defaultRange', 'colorScheme', 'units'];
  const missing = required.filter(field => !(field in config));
  
  if (missing.length > 0) {
    console.warn(`Variable config missing required fields: ${missing.join(', ')}`);
    return false;
  }
  
  const { defaultRange } = config;
  if (!defaultRange || typeof defaultRange.min !== 'number' || typeof defaultRange.max !== 'number') {
    console.warn('Invalid defaultRange in variable config');
    return false;
  }
  
  if (defaultRange.min >= defaultRange.max) {
    console.warn('Invalid range: min must be less than max');
    return false;
  }
  
  return true;
};

// Default variable order for table display - Mean Wave Direction first
export const DEFAULT_VARIABLE_ORDER = ['dirm', 'hs', 'tm02', 'tpeak', 'ws', 'wd', 'sst'];

// Get ordered variables based on availability
export const getOrderedVariables = (availableKeys) => {
  const ordered = DEFAULT_VARIABLE_ORDER.filter(key => availableKeys.includes(key));
  const remaining = availableKeys.filter(key => !DEFAULT_VARIABLE_ORDER.includes(key));
  return [...ordered, ...remaining];
};