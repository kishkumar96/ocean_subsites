import React, { useEffect, useMemo, useState } from "react";
import Plot from 'react-plotly.js';
import DynamicColorManager from '../utils/DynamicColorManager';

const YLGNBU_STOPS = [
  { value: 0.0, rgb: [8, 29, 88] },
  { value: 0.125, rgb: [37, 52, 148] },
  { value: 0.25, rgb: [34, 94, 168] },
  { value: 0.375, rgb: [29, 145, 192] },
  { value: 0.5, rgb: [65, 182, 196] },
  { value: 0.625, rgb: [127, 205, 187] },
  { value: 0.75, rgb: [199, 233, 180] },
  { value: 0.875, rgb: [237, 248, 217] },
  { value: 1.0, rgb: [255, 255, 204] }
];

const PLASMA_STOPS = [
  { value: 0.0, rgb: [13, 8, 135] },
  { value: 0.1, rgb: [48, 16, 161] },
  { value: 0.2, rgb: [84, 25, 175] },
  { value: 0.35, rgb: [128, 38, 178] },
  { value: 0.5, rgb: [171, 54, 166] },
  { value: 0.65, rgb: [211, 72, 141] },
  { value: 0.8, rgb: [244, 109, 117] },
  { value: 0.9, rgb: [253, 174, 97] },
  { value: 1.0, rgb: [240, 249, 33] }
];

const VARIABLE_CONFIGS = {
  hs: {
    label: 'Significant Wave Height',
    unit: 'm',
    yaxis: 'y1',
    range: { min: 0, max: 14 },
    palette: 'viridis'
  },
  tm02: {
    label: 'Mean Wave Period',
    unit: 's',
    yaxis: 'y2',
    range: { min: 0, max: 20 },
    palette: 'spectral'  // ENHANCED: Spectral divergent for maximum visual distinction
  },
  tpeak: {
    label: 'Peak Wave Period',
    unit: 's',
    yaxis: 'y2',
    range: { min: 9, max: 14 },
    palette: 'plasma'
  },
  tp_p1: {
    label: 'Wind Wave Period',
    unit: 's',
    yaxis: 'y2',
    range: { min: 0, max: 29 },
    palette: 'plasma'
  },
  dirm: {
    label: 'Mean Wave Direction',
    unit: '°',
    yaxis: 'y3',
    range: { min: 0, max: 360 },
    palette: 'direction'
  }
};

const createColorscale = (stops) => stops.map(stop => [stop.value, `rgb(${stop.rgb[0]}, ${stop.rgb[1]}, ${stop.rgb[2]})`]);

const YLGNBU_COLORSCALE = createColorscale(YLGNBU_STOPS);
const PLASMA_COLORSCALE = createColorscale(PLASMA_STOPS);

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
};

const interpolateFromStops = (stops, t) => {
  if (!Array.isArray(stops) || stops.length === 0) return 'rgb(255, 255, 255)';
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i];
    const next = stops[i + 1];
    if (clamped >= current.value && clamped <= next.value) {
      const span = next.value - current.value || 1;
      const factor = (clamped - current.value) / span;
      const r = Math.round(current.rgb[0] + (next.rgb[0] - current.rgb[0]) * factor);
      const g = Math.round(current.rgb[1] + (next.rgb[1] - current.rgb[1]) * factor);
      const b = Math.round(current.rgb[2] + (next.rgb[2] - current.rgb[2]) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const last = stops[stops.length - 1];
  return `rgb(${last.rgb[0]}, ${last.rgb[1]}, ${last.rgb[2]})`;
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

function Timeseries({ perVariableData }) {
  const [plotData, setPlotData] = useState([]);
  const [error, setError] = useState("");
  const [parentHeight, setParentHeight] = useState(undefined);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const dynamicColorManager = useMemo(() => new DynamicColorManager(), []);

  const getColorForValue = useMemo(() => ({
    viridis: (value, range) => {
      const ratio = clamp(value, range.min, range.max);
      return dynamicColorManager.interpolateViridis(ratio);
    },
    ylgnbu: (value, range) => {
      const ratio = clamp(value, range.min, range.max);
      return interpolateFromStops(YLGNBU_STOPS, ratio);
    },
    plasma: (value, range) => {
      const ratio = clamp(value, range.min, range.max);
      return interpolateFromStops(PLASMA_STOPS, ratio);
    },
    direction: () => 'rgb(255, 159, 64)'
  }), [dynamicColorManager]);

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
    const el = document.querySelector('.offcanvas-body');
    if (el) {
      setParentHeight(el.clientHeight - 36);
    }
    const observer = el
      ? new ResizeObserver(() => setParentHeight(el.clientHeight - 36))
      : null;
    if (observer && el) observer.observe(el);
    return () => observer && observer.disconnect();
  }, [perVariableData]);

  useEffect(() => {
    let isMounted = true;
    if (!perVariableData) {
      setPlotData([]);
      setError("No timeseries data available.");
      return;
    }

    const variableKeys = ['hs', 'tm02', 'tpeak', 'tp_p1'];
    const traces = [];

    variableKeys.forEach((key) => {
      const config = VARIABLE_CONFIGS[key];
      const tsJson = perVariableData[key];
      const ts = extractCoverageTimeseries(tsJson, key);

      if (!config || !ts || !Array.isArray(ts.times) || !Array.isArray(ts.values) || ts.times.length === 0) {
        return;
      }

      const { label, yaxis, unit, range, palette } = config;
      const paletteColorFn = getColorForValue[palette] || (() => 'rgb(200, 200, 200)');
      const filteredTimes = [];
      const filteredValues = [];

      ts.times.forEach((timeValue, index) => {
        const rawValue = ts.values[index];
        if (rawValue === null || rawValue === undefined) {
          return;
        }
        filteredTimes.push(timeValue);
        filteredValues.push(rawValue);
      });

      if (filteredTimes.length === 0) {
        return;
      }

      // Add colored line segments to approximate the palette along the curve
      for (let i = 0; i < filteredTimes.length - 1; i++) {
        const currentValue = filteredValues[i];
        const nextValue = filteredValues[i + 1];
        if (!Number.isFinite(currentValue) || !Number.isFinite(nextValue)) continue;
        const midValue = (currentValue + nextValue) / 2;
        traces.push({
          x: [filteredTimes[i], filteredTimes[i + 1]],
          y: [currentValue, nextValue],
          mode: 'lines',
          line: {
            color: paletteColorFn(midValue, range),
            width: 3
          },
          hoverinfo: 'skip',
          showlegend: false,
          yaxis
        });
      }

      const colorscale = palette === 'viridis'
        ? dynamicColorManager.viridisColors.map(stop => [stop.value, stop.color])
        : palette === 'ylgnbu'
          ? YLGNBU_COLORSCALE
          : palette === 'plasma'
            ? PLASMA_COLORSCALE
            : [[0, 'rgb(255, 159, 64)'], [1, 'rgb(255, 159, 64)']];

      traces.push({
        x: filteredTimes,
        y: filteredValues,
        mode: 'markers',
        name: label,
        marker: {
          size: 8,
          color: filteredValues,
          colorscale,
          cmin: range.min,
          cmax: range.max,
          showscale: false,
          line: {
            color: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)',
            width: 1
          }
        },
        hovertemplate: `${label}: %{y:.2f} ${unit}<br>%{x|%Y-%m-%d %H:%M}Z<extra></extra>`,
        yaxis
      });
    });

    if (!isMounted) return;
    setPlotData(traces);
    if (traces.length === 0) setError("No timeseries data returned.");
    else setError("");
    return () => {
      isMounted = false;
    };
  }, [perVariableData, getColorForValue, dynamicColorManager, isDarkMode]);

  if (!perVariableData) return <div>No data available.</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (plotData.length === 0) return <div>No timeseries data.</div>;

  const layout = {
    autosize: true,
    height: parentHeight || 400,
    margin: { t: 40, l: 60, r: 60, b: 60 },
    paper_bgcolor: isDarkMode ? '#2e2f33' : '#ffffff',
    plot_bgcolor: isDarkMode ? '#2e2f33' : '#ffffff',
    font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
    legend: { 
      orientation: 'h', 
      y: -0.2,
      font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
      bgcolor: isDarkMode ? '#3f4854' : '#ffffff',
      bordercolor: isDarkMode ? '#44454a' : '#e2e8f0',
      itemclick: false,
      itemdoubleclick: false
    },
    xaxis: { 
      title: { text: 'Time', font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' } }, 
      tickangle: -45,
      showgrid: true,
      gridcolor: isDarkMode ? '#44454a' : '#e2e8f0',
      tickfont: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
      zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
    },
    yaxis: { 
      title: { 
        text: 'Height (m)', 
        font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
        standoff: 30
      }, 
      side: 'left',
      showgrid: true,
      gridcolor: isDarkMode ? '#44454a' : '#e2e8f0',
      tickfont: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
      zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
    },
    yaxis2: {
      title: { 
        text: 'Period (s)', 
        font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
        standoff: 30,
        x: 1.15
      },
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      tickfont: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
      zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
    },
    yaxis3: {
      title: { 
        text: 'Direction (°)', 
        font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
        standoff: 10,
        x: 1.25
      },
      overlaying: 'y',
      side: 'right',
      position: 1,
      showgrid: false,
      tickfont: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
      zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
    },
    showlegend: true,
  };

  return (
    <div style={{ width: "100%", height: parentHeight ? `${parentHeight}px` : "100%" }}>
      <Plot
        data={plotData}
        layout={layout}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ responsive: true }}
      />
    </div>
  );
}

export default Timeseries;
