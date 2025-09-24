import React, { useState } from 'react';

// Debug component to test the controls independently
function DebugControls() {
  const [selectValue, setSelectValue] = useState('hs');
  const [sliderValue, setSliderValue] = useState(50);

  const options = [
    { value: 'composite_hs_dirm', label: 'Significant Wave Height + Dir' },
    { value: 'hs', label: 'Significant Wave Height (Hm0)' },
    { value: 'dirm', label: 'Wave Direction (arrow)' },
    { value: 'tm02', label: 'Mean Wave Period (Tm02)' },
    { value: 'tpeak', label: 'Peak Wave Period (Tp)' }
  ];

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
      <h3>Debug Controls Test</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="debug-select">Wave Forecast Layer:</label>
        <select
          id="debug-select"
          className="form-select form-select-sm"
          value={selectValue}
          onChange={(e) => {
            console.log('Select changed to:', e.target.value);
            setSelectValue(e.target.value);
          }}
          style={{
            fontSize: '12px',
            height: '26px',
            minHeight: '26px',
            minWidth: '0px',
            width: '100%',
            padding: '2px 8px'
          }}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p>Current value: {selectValue}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="debug-slider">Time Slider:</label>
        <input
          id="debug-slider"
          className="form-range custom-range-slider2"
          type="range"
          min="0"
          max="228"
          step="1"
          value={sliderValue}
          onChange={(e) => {
            console.log('Slider changed to:', e.target.value);
            setSliderValue(Number(e.target.value));
          }}
          style={{
            flex: '1 1 0%',
            height: '22px',
            minHeight: '18px',
            margin: '0px',
            padding: '0px'
          }}
        />
        <p>Current value: {sliderValue}</p>
      </div>
    </div>
  );
}

export default DebugControls;