import React, { useRef, useState, useEffect } from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
import 'chart.js/auto';
import Plot from 'react-plotly.js';
import './BottomBuoyOffCanvas.css';
import './WorldClassOffCanvas.css';
import useMapContainerRect from "../hooks/useMapContainerRect";


// Fixed color palette for datasets
const BUOY_COLORS = [
  '#D81B60', // Vivid Pink
  '#1E88E5', // Vivid Blue
  '#FFC107', // Vivid Amber
];

const MODEL_COLORS = [
  '#004D40', // Deep Teal
  '#F4511E', // Vivid Orange
  '#43A047', // Vivid Green
];

const FALLBACK_MIN_HEIGHT = 140;
const FALLBACK_MAX_HEIGHT = 900;

function computePanelBounds() {
  if (typeof window === 'undefined') {
    const initial = Math.min(Math.max(400, FALLBACK_MIN_HEIGHT), FALLBACK_MAX_HEIGHT);
    return { min: FALLBACK_MIN_HEIGHT, max: FALLBACK_MAX_HEIGHT, initial };
  }

  const viewportHeight = window.innerHeight;
  const min = Math.min(
    Math.max(Math.round(viewportHeight * 0.25), FALLBACK_MIN_HEIGHT),
    320
  );
  const max = Math.max(Math.round(viewportHeight * 0.85), min + 180);
  const initialCandidate = Math.round(viewportHeight * 0.5);
  const initial = Math.min(Math.max(initialCandidate, min + 60), max);
  return { min, max, initial };
}

const MODEL_VARIABLES = ["hs_p1", "tp_p1", "dirp_p1"];
const LATEST_CAPABILITY_URL = "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc?service=WMS&version=1.3.0&request=GetCapabilities";
const PREVIOUS_CAPABILITY_URL = "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID_01.nc?service=WMS&version=1.3.0&request=GetCapabilities";

// Time parsing functions reused
function parseTimeDimensionFromCapabilities(xml, layerName) {
  const parser = new window.DOMParser();
  const dom = parser.parseFromString(xml, "text/xml");
  const layers = Array.from(dom.getElementsByTagName("Layer"));
  let targetLayer = null;
  for (const l of layers) {
    const nameNode = l.getElementsByTagName("Name")[0];
    if (nameNode && nameNode.textContent === layerName) {
      targetLayer = l;
      break;
    }
  }
  if (!targetLayer) return null;
  const dimensionNodes = Array.from(targetLayer.getElementsByTagName("Dimension"));
  for (const dim of dimensionNodes) {
    if (dim.getAttribute("name") === "time") {
      return {
        raw: dim.textContent.trim(),
        defaultTime: dim.getAttribute("default") || null
      };
    }
  }
  const extentNodes = Array.from(targetLayer.getElementsByTagName("Extent"));
  for (const ext of extentNodes) {
    if (ext.getAttribute("name") === "time") {
      return {
        raw: ext.textContent.trim(),
        defaultTime: ext.getAttribute("default") || null
      };
    }
  }
  return null;
}

function getTimeRangeFromDimension(dimStr) {
  if (!dimStr) return null;
  if (dimStr.includes("/")) {
    const [start, end, step] = dimStr.split("/");
    return {
      start: new Date(start),
      end: new Date(end),
      step: step || "PT1H"
    };
  }
  const times = dimStr.split(",").map(s => new Date(s));
  if (times.length > 1) {
    const stepMs = times[1] - times[0];

    return {
      start: times[0],
      end: times[times.length - 1],
      step: `PT${Math.round(stepMs / 1000 / 60 / 60)}H`
    };
  }
  return null;
}

function formatDateISOString(date) {
  return date.toISOString().split(".")[0] + ".000Z";
}

// New functions for fetching forecast data
async function fetchCapabilities(url) {
  //console.log(`Fetching capabilities from: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch capabilities from ${url}`);
  const xml = await res.text();
  //console.log("URL::" + url);
  return xml;
}

async function fetchForecastData(baseUrl, layer, timeRange) {
  const timeParam = `${formatDateISOString(timeRange.start)}/${formatDateISOString(timeRange.end)}`;
  const url = `${baseUrl}?REQUEST=GetTimeseries&LAYERS=${layer}&QUERY_LAYERS=${layer}&BBOX=-169.9315,-19.05455,-169.9314,-19.05445&SRS=CRS:84&FEATURE_COUNT=5&HEIGHT=1&WIDTH=1&X=0&Y=0&STYLES=default/default&VERSION=1.1.1&TIME=${timeParam}&INFO_FORMAT=text/json`;
  
  console.log(`Fetching forecast data from: ${url}`);
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch forecast data from ${baseUrl}`);
  const json = await res.json();
  
  //console.log(`Forecast data response for ${baseUrl} [${layer}]:`, json);
  //console.log(`Time range: ${timeParam}`);
  //console.log(`Data points: ${json.domain?.axes?.t?.values?.length || 0}`);
  
  return json;
}

async function fetchCombinedForecastData() {
  try {
    // Fetch capabilities from both forecasts
    const [latestCapabilities, previousCapabilities] = await Promise.all([
      fetchCapabilities(LATEST_CAPABILITY_URL),
      fetchCapabilities(PREVIOUS_CAPABILITY_URL)
    ]);

    // Parse time dimensions
    const latestTimeDim = parseTimeDimensionFromCapabilities(latestCapabilities, "hs_p1");
    const previousTimeDim = parseTimeDimensionFromCapabilities(previousCapabilities, "hs_p1");
    console.log("latestTimeDim:: " + latestTimeDim);

    //console.log('Parsed time dimensions:');
    //console.log('Latest time dimension:', latestTimeDim);
    //console.log('Previous time dimension:', previousTimeDim);

    if (!latestTimeDim || !previousTimeDim) {
      throw new Error("Could not parse time dimensions from capabilities");
    }

    const latestTimeRange = getTimeRangeFromDimension(latestTimeDim.raw);
    const previousTimeRange = getTimeRangeFromDimension(previousTimeDim.raw);

    //console.log('Parsed time ranges:');
    //console.log('Latest time range:', latestTimeRange);
    //console.log('Previous time range:', previousTimeRange);

    if (!latestTimeRange || !previousTimeRange) {
      throw new Error("Could not parse time ranges");
    }

    // Calculate time ranges for each forecast
    const sevenAndHalfDaysAgo = new Date(latestTimeRange.end.getTime() - (7.5 * 24 * 60 * 60 * 1000));
    const latestStart = sevenAndHalfDaysAgo;
    const latestEnd = latestTimeRange.end;
    const previousStart = previousTimeRange.start;
    const previousEnd = latestTimeRange.start;

    //console.log('Time ranges:', {
    //   latest: { start: latestStart, end: latestEnd },
    //   previous: { start: previousStart, end: previousEnd }
    // });

    // For each variable, fetch latest and previous separately, then combine
    const combinedRanges = {};
    let combinedDomain = null;
    let combinedParameters = {};
    for (const v of MODEL_VARIABLES) {
      // Fetch both latest and previous for this variable
      const [latestData, previousData] = await Promise.all([
        fetchForecastData(
          "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc",
          v,
          { start: latestStart, end: latestEnd }
        ),
        fetchForecastData(
          "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID_01.nc",
          v,
          { start: previousStart, end: previousEnd }
        )
      ]);
      console.log(previousData)
      // // Debug: print the full JSON for tp_p1 and dirp_p1
      // if (v === "tp_p1" || v === "dirp") {
      //   //console.log(`Full latestData for ${v}:`, latestData);
      //   //console.log(`Full previousData for ${v}:`, previousData);
      // }
      // For the first variable, set the domain and parameters
      if (!combinedDomain) {
        combinedDomain = {
          axes: {
            t: {
              values: [
                ...previousData.domain.axes.t.values,
                ...latestData.domain.axes.t.values
              ]
            }
          }
        };
      }
      combinedParameters = {
        ...combinedParameters,
        ...previousData.parameters,
        ...latestData.parameters
      };
      combinedRanges[v] = {
        values: [
          ...(previousData.ranges?.[v]?.values || []),
          ...(latestData.ranges?.[v]?.values || [])
        ]
      };
      // //console.log(`Sample ${v} values:`, combinedRanges[v].values.slice(0, 5));
      // //console.log(`Combined ${v} values length:`, combinedRanges[v].values.length);
    }

    const combinedData = {
      domain: combinedDomain,
      parameters: combinedParameters,
      ranges: combinedRanges
    };

    // //console.log('Combined forecast data:', combinedData);
    // //console.log('Total combined data points:', combinedData.domain.axes.t.values.length);
    // //console.log('Sample time values:', combinedData.domain.axes.t.values.slice(0, 5));

    return combinedData;
  } catch (error) {
    console.error('Error fetching combined forecast data:', error);
    throw error;
  }
}

async function fetchAllModelVariables() {
  try {
    const combinedData = await fetchCombinedForecastData();
    return [{ layer: "combined", json: combinedData }];
  } catch (error) {
    throw error;
  }
}

// function extractModelVariables(model, variables) {
//   // Always return arrays for requested variables, fill with nulls if missing
//   const result = {};
//   const N = model.domain.axes.t.values.length;
//   for (const v of variables) {
//     if (model.ranges && model.ranges[v]) {
//       result[v] = {
//         values: model.ranges[v].values,
//         label:
//           (model.parameters &&
//             model.parameters[v] &&
//             (model.parameters[v].description?.en ||
//               model.parameters[v].observedProperty?.label?.en ||
//               v)) ||
//           v,
//       };
//     } else {
//       // Fill with nulls so axes always appear, but line will not show
//       result[v] = {
//         values: Array(N).fill(null),
//         label: v,
//       };
//     }
//   }
//   return result;
// }

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error in Plotly component:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '1rem' }}>
          <p>Error rendering chart: {this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function BottomBuoyOffCanvas({ show, onHide, buoyId }) {
  const [panelBounds, setPanelBounds] = useState(() => computePanelBounds());
  const [height, setHeight] = useState(() => computePanelBounds().initial);
  const [activeTab, setActiveTab] = useState("buoy");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [/* parentHeight */, setParentHeight] = useState(undefined);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const mapRect = useMapContainerRect(show);

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

  // Model state
  const [modelData, setModelData] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");


  // Drag handle logic
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(height);
  const onMouseDown = (e) => {
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };
  const onMouseMove = (e) => {
    if (!dragging.current) return;
    let newHeight = startHeight.current - (e.clientY - startY.current);
    newHeight = Math.min(Math.max(newHeight, panelBounds.min), panelBounds.max);
    setHeight(newHeight);
  };
  const onMouseUp = () => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  // Chart dynamic height based on Offcanvas.Body
  useEffect(() => {
    let timer = null;
    let observer = null;
    function measure() {
      const el = document.querySelector('.offcanvas-body');
      if (el) setParentHeight(el.clientHeight - 36);
    }
    if (show) {
      timer = setTimeout(measure, 250);
      const el = document.querySelector('.offcanvas-body');
      if (el && window.ResizeObserver) {
        observer = new window.ResizeObserver(measure);
        observer.observe(el);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [show, buoyId]);

  useEffect(() => {
    const handleResize = () => {
      const bounds = computePanelBounds();
      setPanelBounds(bounds);
      setHeight(prev => {
        const clamped = Math.min(Math.max(prev, bounds.min), bounds.max);
        return clamped === prev ? prev : clamped;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch Sofarocean data when buoyId changes and panel is open
  useEffect(() => {

    if (!show || !buoyId) return;
    setLoading(true);
    setFetchError("");
    setData(null);
    const token = "2a348598f294c6b0ce5f7e41e5c0f5";
    const url = `https://api.sofarocean.com/api/wave-data?spotterId=${buoyId}&token=${token}&includeWindData=false&includeDirectionalMoments=true&includeSurfaceTempData=true&limit=100&includeTrack=true`;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(json => {

        setData(json.data);
        setLoading(false);
        setHasLoadedData(prev => ({ ...prev, buoy: true }));
      })
      .catch(e => {
       setFetchError("Failed to fetch buoy data");
        setLoading(false);
        setHasLoadedData(prev => ({ ...prev, buoy: false }));
      });
  }, [buoyId, show]);

  // Fetch model data for all variables in parallel
  useEffect(() => {
    if (!show) return;
    setModelLoading(true);
    setModelError("");
    setModelData(null);

    fetchAllModelVariables()
      .then(results => {
        // Use the first result's domain as base (all should match)
        const domain = results[0].json.domain;
        const parameters = results[0].json.parameters;
        const ranges = results[0].json.ranges;
        setModelData({ domain, parameters, ranges });
        setModelLoading(false);
        setHasLoadedData(prev => ({ ...prev, model: true }));
      })
      .catch(e => {
        console.error('Error fetching model data:', e);
        setModelError("Failed to fetch model data: " + e.message);
        setModelLoading(false);
        setHasLoadedData(prev => ({ ...prev, model: false }));
      });
  }, [show]);



  // Prepare chart data and formatting for Sofarocean
  // let chartData = null;
  // let chartOptions = {};
  let plotlyBuoyData = null;
  let plotlyBuoyLayout = null;
  if (activeTab === "buoy" && data && data.waves && data.waves.length > 0) {
    const waves = data.waves;
    const labels = waves.map(w =>
      typeof w.timestamp === "string" && w.timestamp.length > 15
        ? w.timestamp.substring(0, 16).replace("T", " ")
        : w.timestamp
    );
    plotlyBuoyData = [
      {
        x: labels,
        y: waves.map(w => w.significantWaveHeight),
        name: "Significant Wave Height (m)",
        type: 'scatter',
        mode: 'lines',
        //marker: { color: BUOY_COLORS[0], symbol: 'circle', size: 6 },
        line: { color: BUOY_COLORS[0], width: 2 },
        yaxis: 'y',
      },
      {
        x: labels,
        y: waves.map(w => w.meanPeriod),
        name: "Mean Period (s)",
        type: 'scatter',
        mode: 'lines',
        //marker: { color: BUOY_COLORS[1], symbol: 'square', size: 6 },
        line: { color: BUOY_COLORS[1], width: 2, dash: 'dot' },
        yaxis: 'y2',
      },
      {
        x: labels,
        y: waves.map(w => w.meanDirection),
        name: "Mean Direction (°)",
        type: 'scatter',
        mode: 'lines',
        //marker: { color: BUOY_COLORS[2], symbol: 'diamond', size: 7 },
        line: { color: BUOY_COLORS[2], width: 2, dash: 'dash' },
        yaxis: 'y3',
      },
    ];
    plotlyBuoyLayout = {
      autosize: true,
      height: Math.max(Math.min(height - 100, 500), 300),
      margin: { t: 80, l: 80, r: 140, b: 80 },
      paper_bgcolor: isDarkMode ? '#2e2f33' : '#ffffff',
      plot_bgcolor: isDarkMode ? '#2e2f33' : '#ffffff',
      font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
      legend: { 
        orientation: 'h', 
        y: 1.20, 
        x: 0.5, 
        xanchor: 'center',
        font: { 
          color: isDarkMode ? '#f1f5f9' : '#1e293b',
          size: 12,
          family: 'Inter, sans-serif'
        },
        bgcolor: isDarkMode ? 'rgba(63, 72, 84, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        bordercolor: isDarkMode ? '#44454a' : '#e2e8f0',
        borderwidth: 1
      },
      xaxis: { 
        title: { 
          text: 'Time (UTC)', 
          font: { 
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            weight: 500
          }
        }, 
        tickangle: -45, 
        showgrid: true,
        gridcolor: isDarkMode ? '#374151' : '#f3f4f6',
        gridwidth: 1,
        tickmode: 'auto',
        nticks: 8,
        tickformat: '%b %d<br>%H:%M',
        tickfont: { 
          size: 10, 
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          family: 'Inter, sans-serif'
        },
        tickwidth: 1,
        ticklen: 5,
        tickcolor: isDarkMode ? '#6b7280' : '#9ca3af',
        showticklabels: true,
        automargin: true,
        zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
      },
      yaxis: { 
        title: { 
          text: 'Wave Height (m)', 
          font: { 
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            weight: 500
          }
        }, 
        side: 'left', 
        showgrid: true, 
        gridcolor: isDarkMode ? '#374151' : '#f3f4f6',
        gridwidth: 1,
        zeroline: false,
        tickfont: { 
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          size: 11,
          family: 'Inter, sans-serif'
        },
        tickformat: '.2f',
        tickmode: 'linear',
        dtick: 0.5,
        zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
      },
      yaxis2: {
        title: { 
          text: 'Period (s)', 
          font: { 
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            weight: 500
          }
        },
        overlaying: 'y',
        side: 'right',
        position: 1.0,
        showgrid: false,
        zeroline: false,
        anchor: 'free',
        tickfont: { 
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          size: 11,
          family: 'Inter, sans-serif'
        },
        tickformat: '.1f',
        tickmode: 'linear',
        dtick: 2,
        zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
      },
      yaxis3: {
        title: { 
          text: 'Direction (°)', 
          font: { 
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            weight: 500
          }
        },
        overlaying: 'y',
        side: 'right',
        position: 1.12,
        showgrid: false,
        zeroline: false,
        anchor: 'free',
        tickfont: { 
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          size: 11,
          family: 'Inter, sans-serif'
        },
        tickformat: '.0f',
        tickmode: 'linear',
        dtick: 45,
        range: [0, 360],
        zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
      },
      hovermode: 'x unified',
      showlegend: true,
      dragmode: 'pan',
    };
  }

  // Prepare chart data for model
  let modelChartData = null;
  // let modelChartOptions = {};
  let plotlyModelData = [];
  let plotlyModelLayout = null;
  let modelMissingVars = [];
  if (activeTab === "model" && modelData && modelData.domain && modelData.domain.axes && modelData.domain.axes.t) {
    const variables = MODEL_VARIABLES;
 
    // const varMeta = extractModelVariables(modelData, variables);
    modelMissingVars = variables.filter(v => !modelData.ranges || !modelData.ranges[v]);
    const labels = modelData.domain.axes.t.values.map(t =>
      t.length > 15 ? t.substring(0, 16).replace("T", " ") : t
    );
    console.log("2");
    // Debug: log the modelData.ranges and the arrays for each variable
    console.log('modelData.ranges:', modelData.ranges);
    //console.log('hs_p1:', modelData.ranges?.hs_p1?.values);
    //console.log('tp_p1:', modelData.ranges?.tp_p1?.values);
    //console.log('dirp_p1:', modelData.ranges?.dirp_p1?.values);
    plotlyModelData = [
      {
        x: labels,
        y: modelData.ranges?.hs_p1?.values || [],
        name: "Significant Wave Height (Model)",
        type: 'scatter',
        mode: 'lines',
        line: { color: MODEL_COLORS[0], width: 2, dash: 'dot' },
        yaxis: 'y',
      },
      {
        x: labels,
        y: modelData.ranges?.tp_p1?.values || [],
        name: "Wind Wave Period (Model)",
        type: 'scatter',
        mode: 'lines',
        line: { color: MODEL_COLORS[1], width: 2, dash: 'dot' },
        yaxis: 'y2',
      }
    ];
    //console.log('plotlyModelData:', plotlyModelData);
    plotlyModelLayout = {
      autosize: true,
      height: Math.max(Math.min(height - 100, 500), 300),
      margin: { t: 80, l: 80, r: 140, b: 80 },
      paper_bgcolor: isDarkMode ? '#2e2f33' : '#ffffff',
      plot_bgcolor: isDarkMode ? '#2e2f33' : '#ffffff',
      font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
      legend: { 
        orientation: 'h', 
        y: 1.20, 
        x: 0.5, 
        xanchor: 'center',
        font: { 
          color: isDarkMode ? '#f1f5f9' : '#1e293b',
          size: 12,
          family: 'Inter, sans-serif'
        },
        bgcolor: isDarkMode ? 'rgba(63, 72, 84, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        bordercolor: isDarkMode ? '#44454a' : '#e2e8f0',
        borderwidth: 1
      },
      xaxis: { 
        title: { 
          text: 'Time (UTC)', 
          font: { 
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            weight: 500
          }
        }, 
        tickangle: -45, 
        showgrid: true,
        gridcolor: isDarkMode ? '#374151' : '#f3f4f6',
        gridwidth: 1,
        tickmode: 'auto',
        nticks: 8,
        tickformat: '%b %d<br>%H:%M',
        tickfont: { 
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          size: 10,
          family: 'Inter, sans-serif'
        },
        zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
      },
      yaxis: { 
        title: { 
          text: 'Wave Height (m)', 
          font: { 
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            weight: 500
          }
        }, 
        side: 'left', 
        showgrid: true, 
        gridcolor: isDarkMode ? '#374151' : '#f3f4f6',
        gridwidth: 1,
        zeroline: false,
        tickfont: { 
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          size: 11,
          family: 'Inter, sans-serif'
        },
        tickformat: '.2f',
        tickmode: 'linear',
        dtick: 0.5,
        zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
      },
      yaxis2: {
        title: { 
          text: 'Period (s)', 
          font: { 
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            weight: 500
          }
        },
        overlaying: 'y',
        side: 'right',
        position: 1.0,
        showgrid: false,
        zeroline: false,
        anchor: 'free',
        tickfont: { 
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          size: 11,
          family: 'Inter, sans-serif'
        },
        tickformat: '.1f',
        tickmode: 'linear',
        dtick: 2,
        zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
      },
      yaxis3: {
        title: { 
          text: 'Direction (°)', 
          font: { 
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            weight: 500
          }
        },
        overlaying: 'y',
        side: 'right',
        position: 1.12,
        showgrid: false,
        zeroline: false,
        anchor: 'free',
        tickfont: { 
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          size: 11,
          family: 'Inter, sans-serif'
        },
        tickformat: '.0f',
        tickmode: 'linear',
        dtick: 45,
        range: [0, 360],
        zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
      },
      hovermode: 'x unified',
      showlegend: true,
      dragmode: 'pan',
    };
  }

  // Add this new state to track if we've loaded data
  const [hasLoadedData, setHasLoadedData] = useState({
    buoy: false,
    model: false
  });

  // Switch to appropriate tab based on buoy
  useEffect(() => {
    if (buoyId === "SPOT-31091C") {
      setActiveTab("combination");
    } else {
      setActiveTab("buoy");
    }
  }, [buoyId]);


  let tabLabels = [];
  
  if (buoyId === "SPOT-31091C") {
    tabLabels = [
      // { key: "model", label: "Model" },
      { key: "combination", label: "Buoy vs Model" }
    ];
  } else {
    tabLabels = [
      { key: "buoy", label: `Buoy: ${buoyId || ""}` }
    ];
  }

  const offcanvasWidth = mapRect ? `${mapRect.width}px` : "100vw";
  const offcanvasLeft = mapRect ? `${mapRect.left}px` : "0";
  const offcanvasRight = mapRect ? "auto" : "0";
  const offcanvasMargin = mapRect ? "0" : "0 auto";

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="bottom"
      className={`world-class-offcanvas ${isDarkMode ? '' : 'light-mode'}`}
      style={{
        height: height,
        zIndex: 12000,
        color: isDarkMode ? "#f1f5f9" : "#1e293b",
        overflow: "visible",
        transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        left: offcanvasLeft,
        right: offcanvasRight,
        width: offcanvasWidth,
        margin: offcanvasMargin,
      }}
      backdrop={false}
      scroll={true}
    >

      {/* World-Class Drag Handle */}
      <div
        className={`world-class-drag-handle ${isDarkMode ? '' : 'light-mode'}`}
        onMouseDown={onMouseDown}
        title="Drag to resize panel"
      />
      
      {/* Professional Header */}
      <div className={`world-class-header ${isDarkMode ? '' : 'light-mode'}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* World-Class Tab Navigation */}
          <div className={`world-class-tabs ${isDarkMode ? '' : 'light-mode'}`}>
            {tabLabels.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`world-class-tab ${activeTab === tab.key ? 'active' : ''} ${isDarkMode ? '' : 'light-mode'}`}
                aria-controls={`tab-panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Professional Close Button */}
          <button
            onClick={onHide}
            type="button"
            aria-label="Close Panel"
            className={`world-class-close ${isDarkMode ? '' : 'light-mode'}`}
          >
            ×
          </button>
        </div>
      </div>
      <Offcanvas.Body className={`world-class-content`}>
        {/* World-Class Loading State */}
        {activeTab === "buoy" && loading && (
          <div className="world-class-loading">
            <div className="world-class-spinner"></div>
            <div className={`world-class-loading-text ${isDarkMode ? '' : 'light-mode'}`}>
              Loading oceanographic buoy data...
            </div>
          </div>
        )}
        
        {/* World-Class Error State */}
        {activeTab === "buoy" && fetchError && (
          <div className={`world-class-error ${isDarkMode ? '' : 'light-mode'}`}>
            <strong>Data Fetch Error</strong><br />
            {fetchError}
          </div>
        )}
        {activeTab === "buoy" && !loading && !fetchError && data?.waves?.length > 0 && (
          <div className={`world-class-chart ${isDarkMode ? '' : 'light-mode'}`} style={{ width: "100%", height: "100%", minHeight: '300px' }}>
            <ErrorBoundary>
              <Plot
                data={plotlyBuoyData}
                layout={{
                  ...plotlyBuoyLayout,
                  autosize: true,
                  height: null,
                  width: null
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%', minHeight: '300px' }}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  scrollZoom: true
                }}
                onError={err => console.error('Plotly error:', err)}
              />
            </ErrorBoundary>
          </div>
        )}
        {activeTab === "buoy" && !loading && !fetchError && (!data?.waves || data.waves.length === 0) && (
          <div className={`world-class-error ${isDarkMode ? '' : 'light-mode'}`}>
            <strong>No Data Available</strong><br />
            No buoy data found for this location and time period.
          </div>
        )}
        {activeTab === "model" && modelLoading && (
          <div className="world-class-loading">
            <div className="world-class-spinner"></div>
            <div className={`world-class-loading-text ${isDarkMode ? '' : 'light-mode'}`}>
              Loading wave forecast model data...
            </div>
          </div>
        )}
        {activeTab === "model" && modelError && (
          <div className={`world-class-error ${isDarkMode ? '' : 'light-mode'}`}>
            <strong>Model Data Error</strong><br />
            {modelError}
          </div>
        )}
        {activeTab === "model" && !modelLoading && !modelError && (
          <div className={`world-class-chart ${isDarkMode ? '' : 'light-mode'}`} style={{ width: "100%", height: "100%", minHeight: '300px' }}>
            <ErrorBoundary>
              <Plot
                data={plotlyModelData}
                layout={{
                  ...plotlyModelLayout,
                  autosize: true,
                  height: null,
                  width: null
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%', minHeight: '300px' }}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  scrollZoom: true
                }}
                onError={err => console.error('Plotly error:', err)}
              />
            </ErrorBoundary>
            {modelMissingVars.length > 0 && (
              <div style={{ color: "orange", textAlign: "center", paddingTop: 10 }}>
                No model data for: {modelMissingVars.join(', ')}
              </div>
            )}
          </div>
        )}
        {activeTab === "model" && !modelLoading && !modelError && !modelChartData && (
          <div className={`world-class-error ${isDarkMode ? '' : 'light-mode'}`}>
            <strong>No Model Data Available</strong><br />
            No wave forecast data found for this location and time period.
          </div>
        )}
        {activeTab === "combination" && (
          <div className={`world-class-chart ${isDarkMode ? '' : 'light-mode'}`} style={{ width: "100%", height: "100%", minHeight: '300px' }}>
            <ErrorBoundary>
              {(!hasLoadedData.buoy || !hasLoadedData.model) ? (
                <div className="world-class-loading">
                  <div className="world-class-spinner"></div>
                  <div className={`world-class-loading-text ${isDarkMode ? '' : 'light-mode'}`}>
                    Loading data for comparison...
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
                    {!hasLoadedData.buoy && 'Loading buoy data...'}
                    {!hasLoadedData.model && ' Loading model data...'}
                  </div>
                </div>
              ) : (
                <Plot
                  data={(() => {
                    // Prepare buoy data with its own time axis
                    let buoyTraces = [];
                    if (data && data.waves && data.waves.length > 0) {
                      const buoyTimes = data.waves.map(w => w.timestamp);
                      const buoyLabels = buoyTimes.map(t => 
                        typeof t === "string" && t.length > 15 ? t.substring(0, 16).replace("T", " ") : t
                      );
                      const buoyData = {
                        hs: data.waves.map(w => w.significantWaveHeight || w.waveHs || w.hs),
                        tpeak: data.waves.map(w => w.meanPeriod || w.peakPeriod || w.waveTp || w.tpeak),
                        dirp: data.waves.map(w => w.meanDirection || w.waveDp || w.dirp)
                      };
                      
                      buoyTraces = [
                        {
                          x: buoyLabels,
                          y: buoyData.hs,
                          name: 'Significant Wave Height (Buoy)',
                          type: 'scatter',
                          mode: 'lines',
                          line: { color: BUOY_COLORS[0], width: 2, dash: 'solid' },
                          yaxis: 'y',
                        },
                        {
                          x: buoyLabels,
                          y: buoyData.tpeak,
                          name: 'Peak Wave Period (Buoy)',
                          type: 'scatter',
                          mode: 'lines',
                          line: { color: BUOY_COLORS[1], width: 2, dash: 'solid' },
                          yaxis: 'y2',
                        },
                        {
                          x: buoyLabels,
                          y: buoyData.dirp,
                          name: 'Mean Wave Direction (Buoy)',
                          type: 'scatter',
                          mode: 'lines',
                          line: { color: BUOY_COLORS[2], width: 2, dash: 'solid' },
                          yaxis: 'y3',
                        }
                      ];
                    }
                    
                    // Prepare model data with its own time axis
                    let modelTraces = [];
                    if (modelData && modelData.domain && modelData.domain.axes && modelData.domain.axes.t) {
                      const modelTimes = modelData.domain.axes.t.values || [];
                      const modelLabels = modelTimes.map(t => 
                        t.length > 15 ? t.substring(0, 16).replace("T", " ") : t
                      );
                      console.log("hs_p1 ::" + modelData.ranges?.hs_p1?.values);
                      console.log("dirp_p1 ::" + modelData.ranges?.dirp_p1?.values);
                      console.log("tp_p1 ::" + modelData.ranges?.tp_p1?.values);
                      

                      modelTraces = [
                        {
                          x: modelLabels,
                          y: modelData.ranges?.hs_p1?.values || [],
                          name: 'Significant Wave Height (Model)',
                          type: 'scatter',
                          mode: 'lines',
                          line: { color: MODEL_COLORS[0], width: 2, dash: 'dot' },
                          yaxis: 'y',
                        },
                        {
                          x: modelLabels,
                          y: modelData.ranges?.tp_p1?.values || [],
                          name: 'Wind Wave Period (Model)',
                          type: 'scatter',
                          mode: 'lines',
                          line: { color: MODEL_COLORS[1], width: 2, dash: 'dot' },
                          yaxis: 'y2',
                        },
                        {
                          x: modelLabels,
                          y: modelData.ranges?.dirp_p1?.values || [],
                          name: 'Wind Wave Direction (Model)',
                          type: 'scatter',
                          mode: 'lines',
                          line: { color: MODEL_COLORS[2], width: 2, dash: 'dot' },
                          yaxis: 'y3',
                        }
                      ];
                    }
                    
                    //console.log('Final traces count:', {
                    //   modelTraces: modelTraces.length,
                    //   buoyTraces: buoyTraces.length,
                    //   total: modelTraces.length + buoyTraces.length
                    // });
                    
                    return [...modelTraces, ...buoyTraces];
                  })()}
                  layout={{
                    title: { 
                      text: "Model vs Buoy: All Variables",
                      font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' }
                    },
                    paper_bgcolor: isDarkMode ? '#2e2f33' : '#ffffff',
                    plot_bgcolor: isDarkMode ? '#2e2f33' : '#ffffff',
                    font: { color: isDarkMode ? '#f1f5f9' : '#1e293b' },
                    xaxis: { 
                      title: { 
                        text: "Time (UTC)", 
                        font: { 
                          color: isDarkMode ? '#f1f5f9' : '#1e293b',
                          size: 13,
                          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                          weight: 500
                        }
                      }, 
                      tickangle: -45, 
                      showgrid: true,
                      gridcolor: isDarkMode ? '#374151' : '#f3f4f6',
                      gridwidth: 1,
                      tickmode: 'auto',
                      nticks: 8,
                      tickformat: '%b %d<br>%H:%M',
                      tickfont: { 
                        size: 10, 
                        color: isDarkMode ? '#d1d5db' : '#4b5563',
                        family: 'Inter, sans-serif'
                      },
                      tickwidth: 1,
                      ticklen: 5,
                      tickcolor: isDarkMode ? '#6b7280' : '#9ca3af',
                      showticklabels: true,
                      automargin: true,
                      zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
                    },
                    yaxis: { 
                      title: { 
                        text: "Wave Height (m)", 
                        font: { 
                          color: isDarkMode ? '#f1f5f9' : '#1e293b',
                          size: 13,
                          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                          weight: 500
                        },
                        standoff: 15
                      }, 
                      side: 'left', 
                      showgrid: true, 
                      gridcolor: isDarkMode ? '#374151' : '#f3f4f6',
                      gridwidth: 1,
                      zeroline: false,
                      tickfont: { 
                        color: isDarkMode ? '#d1d5db' : '#4b5563',
                        size: 11,
                        family: 'Inter, sans-serif'
                      },
                      tickformat: '.2f',
                      tickmode: 'linear',
                      dtick: 0.5,
                      zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
                    },
                    yaxis2: {
                      title: { 
                        text: "Wave Period (s)", 
                        font: { 
                          color: isDarkMode ? '#f1f5f9' : '#1e293b',
                          size: 13,
                          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                          weight: 500
                        },
                        standoff: 15
                      },
                      overlaying: 'y',
                      side: 'right',
                      position: 1.0,
                      showgrid: false,
                      zeroline: false,
                      anchor: 'free',
                      tickfont: { 
                        color: isDarkMode ? '#d1d5db' : '#4b5563',
                        size: 11,
                        family: 'Inter, sans-serif'
                      },
                      tickformat: '.1f',
                      tickmode: 'linear',
                      dtick: 2,
                      zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
                    },
                    yaxis3: {
                      title: { 
                        text: "Direction (°)", 
                        font: { 
                          color: isDarkMode ? '#f1f5f9' : '#1e293b',
                          size: 13,
                          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                          weight: 500
                        },
                        standoff: 15
                      },
                      overlaying: 'y',
                      side: 'right',
                      position: 1.12,
                      showgrid: false,
                      zeroline: false,
                      anchor: 'free',
                      tickfont: { 
                        color: isDarkMode ? '#d1d5db' : '#4b5563',
                        size: 11,
                        family: 'Inter, sans-serif'
                      },
                      tickformat: '.0f',
                      tickmode: 'linear',
                      dtick: 45,
                      range: [0, 360],
                      zerolinecolor: isDarkMode ? '#44454a' : '#e2e8f0'
                    },
                    legend: { 
                      orientation: 'h', 
                      y: 1.20, 
                      x: 0.5, 
                      xanchor: 'center',
                      font: { 
                        color: isDarkMode ? '#f1f5f9' : '#1e293b',
                        size: 12,
                        family: 'Inter, sans-serif'
                      },
                      bgcolor: isDarkMode ? 'rgba(63, 72, 84, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      bordercolor: isDarkMode ? '#44454a' : '#e2e8f0',
                      borderwidth: 1
                    },
                    hovermode: 'x unified',
                    autosize: true,
                    height: Math.max(Math.min(height - 100, 500), 300),
                    margin: { t: 80, l: 80, r: 140, b: 80 },
                    dragmode: 'pan',
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%', minHeight: '300px' }}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    scrollZoom: true,
                    modeBarButtonsToRemove: ['select2d', 'lasso2d'],
                    displaylogo: false
                  }}
                  onError={err => console.error('Plotly error:', err)}
                />
              )}
            </ErrorBoundary>
            {hasLoadedData.buoy && hasLoadedData.model && (
              (() => {
                // Check if all traces are empty
                // const modelTimes = modelData?.domain?.axes?.t?.values || [];
                const hasModel = modelData?.ranges?.hs_p1?.values?.length > 0;
                const hasBuoy = data?.waves?.length > 0;
                if (!hasModel && !hasBuoy) {
                  return (
                    <div style={{
                      textAlign: 'center',
                      color: 'orange',
                      padding: '10px',
                      backgroundColor: '#fff8e1',
                      marginTop: '10px',
                      borderRadius: '4px'
                    }}>
                      No data available for comparison. Please check if both buoy and model data are available.
                    </div>
                  );
                }
                return null;
              })()
            )}
          </div>
        )}
      </Offcanvas.Body>

    </Offcanvas>
  );
}

export default BottomBuoyOffCanvas;
