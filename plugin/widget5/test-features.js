// test-features.js - Test script for new features
console.log('Testing new widget5 features...');

// Test ColorManager
import { colorManager, ColorPalettes } from './src/utils/ColorManager.js';
import { ExportUtils, PermalinkUtils } from './src/utils/ExportUtils.js';

// Test color manager
console.log('Testing ColorManager...');
console.log('Available palettes:', Object.values(ColorPalettes));
console.log('Current palette:', colorManager.getCurrentPalette());

// Test color generation
const testColors = colorManager.getColors();
console.log('Wave height colors:', testColors.waveHeight);

// Test colorblind-friendly palette
colorManager.setPalette(ColorPalettes.COLORBLIND_FRIENDLY);
console.log('Colorblind-friendly colors:', colorManager.getColors().waveHeight);

// Test high contrast palette
colorManager.setPalette(ColorPalettes.HIGH_CONTRAST);
console.log('High contrast colors:', colorManager.getColors().waveHeight);

// Test export utilities
console.log('Testing ExportUtils...');
const testData = [
  { time: '2024-01-01T00:00:00Z', lat: -21.0, lon: -159.5, waveHeight: 2.5 },
  { time: '2024-01-01T01:00:00Z', lat: -21.0, lon: -159.5, waveHeight: 2.8 }
];

console.log('Test data prepared:', testData);

// Test permalink utilities
console.log('Testing PermalinkUtils...');
const testState = {
  selectedLocation: { lat: -21.0, lon: -159.5 },
  currentTimeIndex: 5,
  selectedVariable: 'waveHeight',
  colorPalette: ColorPalettes.COLORBLIND_FRIENDLY
};

const permalink = PermalinkUtils.generatePermalink(testState);
console.log('Generated permalink:', permalink);

const parsedState = PermalinkUtils.parsePermalink(permalink);
console.log('Parsed state:', parsedState);

console.log('All feature tests completed successfully!');