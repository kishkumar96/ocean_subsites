import React, { useEffect, useState } from "react";
// NOTE: These color functions and variable definitions should be moved to a shared utility
// to be used by other components like `timeseries.js`.
// For this example, we'll keep them here but acknowledge they should be centralized.

// --- Marine Color Schemes ---

// Helper to interpolate between two colors
const lerpColor = (a, b, amount) => {
  const ar = a >> 16, ag = (a >> 8) & 0xff, ab = a & 0xff,
        br = b >> 16, bg = (b >> 8) & 0xff, bb = b & 0xff,
        rr = ar + amount * (br - ar),
        rg = ag + amount * (bg - ag),
        rb = ab + amount * (bb - ab);
  return `rgb(${Math.round(rr)}, ${Math.round(rg)}, ${Math.round(rb)})`;
};

// "Ocean Energy" palette for Wave Height (hs)
function oceanEnergyColor(value, min = 0, max = 5) {
  const v = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (v < 0.5) return lerpColor(0x0A285A, 0x0096C8, v * 2);
  if (v < 0.75) return lerpColor(0x0096C8, 0x64DCFF, (v - 0.5) * 4);
  return lerpColor(0x64DCFF, 0xFFFFC8, (v - 0.75) * 4);
}

// ENHANCED "Spectral Divergent" palette for Mean Wave Period (tm02) - Maximum Visual Distinction
function plasmaColor(value, min = 0, max = 20) {
  const v = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Spectral divergent colormap: Red → Orange → Yellow → Green → Cyan → Blue → Purple
  // Provides maximum visual distinction across the full range
  if (v < 0.14) return lerpColor(0x9E0142, 0xD53E4F, v / 0.14);         // Deep red to red
  if (v < 0.29) return lerpColor(0xD53E4F, 0xF46D43, (v - 0.14) / 0.15); // Red to orange-red
  if (v < 0.43) return lerpColor(0xF46D43, 0xFDAE61, (v - 0.29) / 0.14); // Orange-red to orange
  if (v < 0.57) return lerpColor(0xFDAE61, 0xFEE08B, (v - 0.43) / 0.14); // Orange to yellow
  if (v < 0.71) return lerpColor(0xFEE08B, 0xE6F598, (v - 0.57) / 0.14); // Yellow to light green
  if (v < 0.86) return lerpColor(0xE6F598, 0xABDDA4, (v - 0.71) / 0.15); // Light green to green
  return lerpColor(0xABDDA4, 0x66C2A5, (v - 0.86) / 0.14);              // Green to teal
}

// "Magenta" palette for Peak Wave Period (tpeak)
function magentaColor(value, min = 0, max = 20) {
  const v = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (v < 0.7) return lerpColor(0x4A148C, 0xAD1457, v / 0.7);
  return lerpColor(0xAD1457, 0xF06292, (v - 0.7) / 0.3);
}

// Generic fallback (enhanced divergent palettes)
const jetColor = plasmaColor;  // Use enhanced spectral for temporal data
const ylgnbuColor = plasmaColor;  // Upgraded to spectral divergent

// Map old color function names to new ones for compatibility
const blueColor = oceanEnergyColor;
const redColor = (value, min, max) => {
    // Decide which period palette to use, fallback to magenta
    return magentaColor(value, min, max);
};

// --- End of Color Schemes ---

function isColorDark(colorString) {
  if (!colorString) return false;
  let r, g, b;
  const rgbMatch = colorString.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    [r, g, b] = rgbMatch.slice(1, 4).map(Number);
  } else {
    return false;
  }
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

// Arrow SVG for direction
const ArrowSVG = ({ angle, isDarkMode }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" style={{
    display: 'inline-block',
    transform: `rotate(${angle}deg)`,
    verticalAlign: "middle"
  }}>
    <line x1="11" y1="18" x2="11" y2="4" stroke={isDarkMode ? "#f1f5f9" : "#222"} strokeWidth="2"/>
    <polygon points="11,2 7,8 15,8" fill={isDarkMode ? "#f1f5f9" : "#222"} />
  </svg>
);

// Parse label config, detect {calc}, color type, range, decimal places (default 0)
function parseLabelConfig(label) {
  const configMatch = label.match(/\{([^}]*)\}/);
  let config = {};
  if (configMatch) {
    const configParts = configMatch[1].split('/');
    configParts.forEach(part => {
      const lower = part.trim().toLowerCase();
      if (lower === 'calc') config.calc = true;
      else if (['jet', 'dir', 'rd', 'bu', 'ylgnbu'].includes(lower)) config.type = lower;
      else if (/^\d+\s*-\s*\d+$/.test(lower)) {
        const [min, max] = lower.split('-').map(Number);
        config.min = min;
        config.max = max;
      } else if (/^\d+$/.test(lower)) {
        config.decimalPlaces = parseInt(lower, 10);
      }
    });
  }
  if (typeof config.decimalPlaces !== "number") {
    config.decimalPlaces = 0;
  }
  const cleanLabel = label.replace(/\{[^}]*\}/, '').trim();
  return { ...config, cleanLabel };
}

// Dynamic variable definitions based on available data
const getVariableDefinition = (key) => {
  const definitions = {
    'hs': { key: "hs", label: "Wave{0.17-1.66/viridis/1}" },
    'tm02': { key: "tm02", label: "Wave Period{0-20/Spectral/0}" },  // ENHANCED: Spectral divergent
    'tpeak': { key: "tpeak", label: "Peak Wave Period{9-14/Magenta/0}" },
    'dirm': { key: "dirm", label: "Wave direction{0/dir}" },
  };
  
  return definitions[key] || { key: key, label: `${key}{0-10/default/1}` };
};

const COLOR_FUNCTIONS = {
  jet: jetColor,
  rd: redColor,
  bu: blueColor,
  ylgnbu: ylgnbuColor,
  // Add mappings for new color names from parseLabelConfig
  viridis: oceanEnergyColor, // Assuming viridis maps to this for now
  spectral: plasmaColor,
  magenta: magentaColor,
  plasma: jetColor, // Or another appropriate function
  default: blueColor,
};

function extractCoverageTimeseries(json, variable) {
  if (
    !json ||
    !json.domain ||
    !json.domain.axes ||
    !json.domain.axes.t ||
    !json.domain.axes.t.values ||
    !json.ranges ||
    !json.ranges[variable] ||
    !json.ranges[variable].values
  )
    return null;
  const times = json.domain.axes.t.values;
  const values = json.ranges[variable].values;
  return { times, values };
}
function calculateWaveEnergyKw(xValues = [], yValues = []) {
  const rho = 1025;
  const g = 9.81;
  const len = Math.min(xValues.length, yValues.length);
  const result = [];
  for (let i = 0; i < len; i++) {
    const x = xValues[i];
    const y = yValues[i];
    if ((typeof x === "number" || !isNaN(Number(x)))
      && (typeof y === "number" || !isNaN(Number(y)))) {
      const mag = Math.sqrt(Number(x) * Number(x) + Number(y) * Number(y));
      const Hs = mag;
      const T = 8;
      const P = (rho * g * g / (32 * Math.PI)) * (Hs * Hs) * T;
      result.push(P / 1000);
    } else {
      result.push(null);
    }
  }
  return result;
}
const formatSmart = (value, decimalPlaces) => {
  if (value === null || value === undefined || value === "") return '';
  if (typeof value !== "number") {
    let num = Number(value);
    if (isNaN(num)) return String(value).slice(0, 2);
    value = num;
  }
  if (typeof decimalPlaces !== "number") decimalPlaces = 0;
  return value.toFixed(decimalPlaces);
};
function filterToSixHourly(times, values) {
  const filteredTimes = [];
  const filteredValues = [];
  if (!times.length) return { times: filteredTimes, values: filteredValues };
  
  console.log('🕐 Filtering times - input length:', times.length);
  console.log('🕐 First few times:', times.slice(0, 5));
  console.log('🕐 Last few times:', times.slice(-5));
  
  let firstIdx = -1;
  for (let i = 0; i < times.length; i++) {
    const date = new Date(times[i]);
    if (date.getUTCHours() % 6 === 0) {
      console.log('🕐 Found first 6-hourly time at index', i, ':', times[i], 'hour:', date.getUTCHours());
      firstIdx = i;
      break;
    }
  }
  if (firstIdx !== -1) {
    for (let i = firstIdx; i < times.length; i += 6) {
      filteredTimes.push(times[i]);
      filteredValues.push(values[i]);
    }
  }
  
  console.log('🕐 Filtered to', filteredTimes.length, 'times');
  console.log('🕐 First filtered time:', filteredTimes[0]);
  console.log('🕐 Last filtered time:', filteredTimes[filteredTimes.length - 1]);
  
  return { times: filteredTimes, values: filteredValues };
}
function formatTableTime(time) {
  const date = new Date(time);
  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const dayCode = days[date.getDay()];
  const dayNum = String(date.getDate());
  const hour = `${String(date.getHours()).padStart(2, '0')}hr`;
  return (
    <>
      {dayCode} <br />
      {dayNum} <br />
      {hour}
    </>
  );
}
function Tabular({ perVariableData }) {
  const [tableRows, setTableRows] = useState([]);
  const [times, setTimes] = useState([]);
  const [error, setError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Check for dark mode
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.body.classList.contains('dark-mode');
      setIsDarkMode(isDark);
    };
    
    checkTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let allRows = [];
    let timesArr = [];
    
    // Process all available data dynamically
    const dataKeys = Object.keys(perVariableData || {});
    
    for (const key of dataKeys) {
      const variableDef = getVariableDefinition(key);
      const config = parseLabelConfig(variableDef.label);
      
      if (key === "transp_x") {
        // Handle wave energy calculation if both transp_x and transp_y are available
        const tsX = extractCoverageTimeseries(perVariableData["transp_x"], "transp_x");
        const tsY = extractCoverageTimeseries(perVariableData["transp_y"], "transp_y");
        const transpX = tsX && tsX.values ? tsX.values : [];
        const transpY = tsY && tsY.values ? tsY.values : [];
        const filtered = filterToSixHourly(tsX?.times || [], transpX);
        const filteredY = filterToSixHourly(tsY?.times || [], transpY);
        const energyVals = calculateWaveEnergyKw(filtered.values, filteredY.values);
        if (!timesArr.length && filtered.times) timesArr = filtered.times;
        allRows.push({
          key,
          label: config.cleanLabel,
          config,
          values: energyVals
        });
      } else if (key === "transp_y") {
        continue; // Skip transp_y as it's processed with transp_x
      } else {
        const json = perVariableData[key];
        const ts = extractCoverageTimeseries(json, key);
        if (ts && ts.values) {
          const filtered = filterToSixHourly(ts.times, ts.values);
          if (!timesArr.length && filtered.times) timesArr = filtered.times;
          allRows.push({
            key,
            label: config.cleanLabel,
            config,
            values: filtered.values
          });
        } else {
          allRows.push({
            key,
            label: config.cleanLabel,
            config,
            values: []
          });
        }
      }
    }
    
    setTableRows(allRows);
    setTimes(timesArr || []);
    if (allRows.every(s => !s.values.length)) setError("No tabular timeseries data returned.");
    else setError("");
  }, [perVariableData]);
  if (!perVariableData) return <div>No data available.</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!times.length || !tableRows.length) return <div>No tabular timeseries data available.</div>;

  // Table CSS with dark mode support
  const thFirstCol = {
    textAlign: 'center',
    fontWeight: 'normal',
    backgroundColor: isDarkMode ? '#3f4854' : '#eeeeee',
    color: isDarkMode ? '#f1f5f9' : 'black',
    border: `1px solid ${isDarkMode ? '#44454a' : '#E5E4E2'}`,
    whiteSpace: 'nowrap',
    maxWidth: '240px',
    width: 'max-content',
  };
  const thOtherCols = {
    fontWeight: 'normal',
    textAlign: 'center',
    backgroundColor: isDarkMode ? '#3f4854' : '#eeeeee',
    color: isDarkMode ? '#f1f5f9' : 'black',
    border: `1px solid ${isDarkMode ? '#44454a' : '#E5E4E2'}`,
    padding: '0 4px',
    minWidth: 32,
    maxWidth: 48,
    width: 38,
    whiteSpace: 'nowrap',
  };
  const tdFirstCol = {
    fontWeight: 'normal',
    textAlign: 'left',
    padding: '2px 6px',
    border: `1px solid ${isDarkMode ? '#44454a' : '#E5E4E2'}`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '240px',
    width: 'max-content',
    backgroundColor: isDarkMode ? '#3f4854' : '#eeeeee',
    color: isDarkMode ? '#f1f5f9' : 'black',
  };
  const tdOtherCols = {
    fontWeight: 'normal',
    textAlign: 'center',
    padding: '0 6px',
    border: `1px solid ${isDarkMode ? '#44454a' : '#E5E4E2'}`,
    minWidth: 32,
    maxWidth: 48,
    width: 38,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'background 0.2s, color 0.2s',
    backgroundColor: isDarkMode ? '#2e2f33' : 'white',
    color: isDarkMode ? '#f1f5f9' : 'black',
  };

  return (
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table
        style={{
          borderCollapse: 'collapse',
          textAlign: 'center',
          fontSize: 14,
          border: `1px solid ${isDarkMode ? '#44454a' : '#fff'}`,
          tableLayout: 'auto',
          width: 'auto',
          minWidth: 0,
          maxWidth: '100vw',
          backgroundColor: isDarkMode ? '#2e2f33' : 'white',
          color: isDarkMode ? '#f1f5f9' : 'black',
        }}
        className="table table-bordered"
      >
        <thead>
          <tr>
            <th style={thFirstCol}>Parameter</th>
            {times.map((t, idx) => (
              <th key={t} style={thOtherCols}>
                {formatTableTime(t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row) => (
            <tr key={row.key}>
              <td style={tdFirstCol}>{row.label}</td>
              {row.values.map((value, colIdx) => {
                let cellStyle = { ...tdOtherCols };
                const { min=0, max=5, type="bu", decimalPlaces } = row.config || {};
                let colorBg;
                const colorFunc = COLOR_FUNCTIONS[type.toLowerCase()] || COLOR_FUNCTIONS.default;
                if (typeof value === "number" && colorFunc) {
                  colorBg = colorFunc(value, min, max);
                  let colorText = isColorDark(colorBg) ? "#eeeeee" : "#000";
                  cellStyle = { ...cellStyle, backgroundColor: colorBg, color: colorText };
                }
                const isDirection = type === "dir";
                return (
                  <td key={colIdx} style={cellStyle}>
                    {isDirection && typeof value === "number"
                      ? <ArrowSVG angle={value + 180} isDarkMode={isDarkMode} />
                      : formatSmart(value, decimalPlaces)
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default Tabular;
