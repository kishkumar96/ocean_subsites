import React, { useRef, useState, useEffect } from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
import Tabular from "./tabular.js";
import Timeseries from "./timeseries.js";
import MapPreview from "./map.js";
import useMapContainerRect from "../hooks/useMapContainerRect";

// ---- Variables & config shared between modules ----
// BottomOffCanvas now works dynamically with available forecast data

const FORECAST_VARIABLE_KEYS = ['hs', 'tm02', 'tpeak', 'dirm'];

// ---- Centralized fetching helpers ----
async function fetchLayerTimeseries(layer, data) {
  if (!data || !data.bbox || (data.x === undefined && data.i === undefined) || (data.y === undefined && data.j === undefined)) return null;
  
  let timeParam = '';
  let filterWindowStart = null;
  let filterWindowEnd = null;
  if (data.timeDimension) {
    if (data.timeDimension.includes('/')) {
      const [startIso, endIso] = data.timeDimension.split('/');
      const parsedStart = startIso ? new Date(startIso) : null;
      const parsedEnd = endIso ? new Date(endIso) : null;
      if (parsedStart && !Number.isNaN(parsedStart.getTime())) {
        filterWindowStart = new Date(parsedStart);
        filterWindowStart.setMilliseconds(0);
        const sevenDayEnd = new Date(filterWindowStart);
        sevenDayEnd.setDate(sevenDayEnd.getDate() + 7);
        if (parsedEnd && !Number.isNaN(parsedEnd.getTime()) && parsedEnd < sevenDayEnd) {
          filterWindowEnd = new Date(parsedEnd);
          filterWindowEnd.setMilliseconds(0);
        } else {
          filterWindowEnd = sevenDayEnd;
        }
        timeParam = `${filterWindowStart.toISOString()}/${filterWindowEnd.toISOString()}`;
      } else {
        timeParam = data.timeDimension;
      }
    } else {
      const center = new Date(data.timeDimension);
      if (!Number.isNaN(center.getTime())) {
        filterWindowStart = new Date(center);
        filterWindowStart.setMilliseconds(0);
        filterWindowEnd = new Date(center);
        filterWindowEnd.setDate(filterWindowEnd.getDate() + 7);
        timeParam = `${filterWindowStart.toISOString()}/${filterWindowEnd.toISOString()}`;
      }
    }
  }
  if (!timeParam) {
    // Fallback to a small forward window from now to avoid server 500s
    const now = new Date();
    now.setMilliseconds(0);
    const future = new Date(now);
    future.setDate(future.getDate() + 7);
    timeParam = `${now.toISOString()}/${future.toISOString()}`;
    filterWindowStart = now;
    filterWindowEnd = future;
  }
  
  const pixelX = data.x !== undefined ? data.x : data.i;
  const pixelY = data.y !== undefined ? data.y : data.j;
  const width = data.width || 256;
  const height = data.height || 256;
  
  // Use proper ncWMS GetTimeseries format (same as GetFeatureInfo)
  const url =
    "https://gem-ncwms-hpc.spc.int/ncWMS/wms" +
    `?REQUEST=GetTimeseries` +
    `&VERSION=1.3.0` + // Required parameter
    `&LAYERS=${layer}` +
    `&QUERY_LAYERS=${layer}` +
    `&BBOX=${data.bbox}` +
    `&CRS=EPSG:4326` +
    `&HEIGHT=${height}` +
    `&WIDTH=${width}` +
    `&I=${pixelX}` +
    `&J=${pixelY}` +
    `&TIME=${encodeURIComponent(timeParam)}` +
    `&INFO_FORMAT=text/csv`; // CSV format works better than JSON for timeseries
    
  console.log('🌊 Fetching real timeseries:', url);
  
  try {
    const response = await fetch(url);
    console.log('🌊 Raw GetTimeseries response:', response); // Log the response object
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`GetTimeseries failed (${response.status}): ${response.statusText} - ${errorText}`);
      return null;
    }
    const csvText = await response.text();
    console.log('🌊 Received timeseries CSV:', csvText);
    
    if (!csvText) return null;

    // Parse CSV response into structured data
    const lines = csvText.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    if (lines.length < 2) return null;
    
    const headers = lines[0].split(',');
    const timeseriesData = [];
    const times = [];
    const values = [];
    const rawTimes = [];
    const rawValues = [];
    const rawSeries = [];
    const effectiveStart = filterWindowStart instanceof Date && !Number.isNaN(filterWindowStart?.getTime())
      ? filterWindowStart
      : null;
    const effectiveEnd = filterWindowEnd instanceof Date && !Number.isNaN(filterWindowEnd?.getTime())
      ? filterWindowEnd
      : (effectiveStart ? new Date(effectiveStart.getTime() + 7 * 24 * 60 * 60 * 1000) : null);

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length >= 2) {
        const time = row[0];
        const parsedValue = row[1] !== 'null' ? parseFloat(row[1]) : null;
        const value = Number.isFinite(parsedValue) ? parsedValue : null;
        rawTimes.push(time);
        rawValues.push(value);
        rawSeries.push({ time, value, unit: headers[1] });

        const sampleDate = new Date(time);
        const sampleTime = sampleDate instanceof Date ? sampleDate.getTime() : Number.NaN;
        const isValidSample = Number.isFinite(sampleTime);
        const withinStart = !effectiveStart || (isValidSample && sampleTime >= effectiveStart.getTime());
        const withinEnd = !effectiveEnd || (isValidSample && sampleTime <= effectiveEnd.getTime());

        if (isValidSample && withinStart && withinEnd) {
          times.push(time);
          values.push(value);
          timeseriesData.push({ time, value, unit: headers[1] });
        }
      }
    }

    if (times.length === 0 && rawTimes.length > 0) {
      rawTimes.forEach((time, index) => {
        const value = rawValues[index];
        times.push(time);
        values.push(value);
        timeseriesData.push(rawSeries[index]);
      });
    }

    // Convert to coverage format expected by Tabular/Timeseries components
    console.log('🔄 Converting CSV to coverage format:', { layer, timesLength: times.length, valuesLength: values.length });
    
    const coverage = {
      type: "Coverage",
      domain: {
        type: "Domain",
        domainType: "PointSeries",
        axes: {
          t: {
            values: times
          }
        }
      },
      ranges: {}
    };
    
    // Add the variable data as a range (use variable name, not full layer path)
    const variableName = layer.includes('/') ? layer.split('/')[1] : layer;
    coverage.ranges[variableName] = {
      type: "NdArray",
      dataType: "float",
      values: values
    };
    
    console.log('✅ Created coverage format:', coverage);
    
    return {
      layer,
      data: timeseriesData,
      headers,
      csvText,
      coverage  // This is what the components actually need
    };
  } catch (error) {
    console.error('GetTimeseries request failed:', error);
    return null;
  }
}

const MIN_HEIGHT = 180;
const MAX_HEIGHT = 800;

const tabLabels = [
  { key: "tabular", label: "Tabular" },
  { key: "timeseries", label: "Timeseries" },
  { key: "map", label: "Map" }
];

// This is a conceptual change. The data fetching logic in the main useEffect
// should be extracted into a custom hook like `useForecastData(data)`.
// const { perVariableData, loading, fetchError } = useForecastData(data);

function BottomOffCanvas({ show, onHide, data }) {
  const [height, setHeight] = useState(500);
  const [activeTab, setActiveTab] = useState("tabular");
  const [perVariableData, setPerVariableData] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [portalTarget, setPortalTarget] = useState(null);
  const mapRect = useMapContainerRect(show);

  useEffect(() => {
    if (typeof document !== "undefined") {
      setPortalTarget(document.body);
    }
  }, []);

  // Drag handle logic
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(500);
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
    newHeight = Math.min(Math.max(newHeight, MIN_HEIGHT), MAX_HEIGHT);
    setHeight(newHeight);
  };
  const onMouseUp = () => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  // Process the passed data and create dynamic variable data
  useEffect(() => {
    let isMounted = true;
    if (!data) {
      setPerVariableData({});
      setFetchError("No data available");
      return;
    }
    
    setLoading(true);
    setFetchError("");
    
    // Create dynamic data based on the current layer being sampled
    const processCurrentLayerData = async () => {
      const out = {};
      const layerName = data.layerName || '';
      const hasDataset = layerName.includes('/');
      const [datasetName, variableKey] = hasDataset
        ? layerName.split('/')
        : [null, layerName];
      const availableVariables = FORECAST_VARIABLE_KEYS;
      const shouldFetchVariableFamily = datasetName && FORECAST_VARIABLE_KEYS.includes(variableKey);

      console.log('🎯 Processing layer data:', {
        layerName,
        datasetName,
        variableKey,
        hasLayerName: !!data.layerName,
        hasBbox: !!data.bbox,
        bboxValue: data.bbox
      });
      console.log('🎯 Data structure:', {
        hasFeatureInfo: !!data.featureInfo,
        featureInfo: data.featureInfo,
        hasBbox: !!data.bbox,
        bbox: data.bbox
      });

      const layersToFetch = [];
      if (shouldFetchVariableFamily && data.bbox) {
        availableVariables.forEach(variable => {
          layersToFetch.push(`${datasetName}/${variable}`);
        });
      } else if (layerName && data.bbox) {
        layersToFetch.push(layerName);
      }

      const uniqueLayers = Array.from(new Set(layersToFetch));

      if (data.bbox && uniqueLayers.length > 0) {
        const fetchPromises = uniqueLayers.map(async layerId => {
          const key = layerId.includes('/') ? layerId.split('/')[1] : layerId;
          try {
            console.log('🚀 Fetching timeseries for:', { layerId, key });
            const layerData = await fetchLayerTimeseries(layerId, data);
            console.log('📦 Received layerData:', { layerId, hasCoverage: !!(layerData && layerData.coverage) });

            if (layerData && layerData.coverage) {
              out[key] = layerData.coverage;
            } else {
              console.warn('❌ No coverage data found in layerData:', { layerId, layerData });
            }
          } catch (error) {
            console.log(`Could not fetch timeseries for ${layerId}:`, error);
          }
        });

        await Promise.all(fetchPromises);
      }

      if (variableKey && !out[variableKey] && data.featureInfo && data.featureInfo !== "Loading..." && data.featureInfo !== "No Data") {
        console.log('🎯 Using current point data as fallback for selected variable:', data.featureInfo);
        const currentTime = new Date().toISOString();
        const pointData = {
          domain: {
            domainType: "PointSeries",
            axes: {
              t: { values: [currentTime] }
            }
          },
          ranges: {
            [variableKey]: {
              type: "NdArray",
              dataType: "float",
              values: [parseFloat(data.featureInfo) || 0]
            }
          }
        };

        out[variableKey] = pointData;
      }

      if (!isMounted) return;

      console.log('🎯 Final perVariableData being set:', out);
      console.log('🎯 Keys in perVariableData:', Object.keys(out));

      setPerVariableData(out);
      setLoading(false);

      if (Object.keys(out).length === 0) {
        setFetchError("No forecast data available for current location.");
      } else {
        console.log('✅ PerVariableData set successfully with', Object.keys(out).length, 'variables');
      }
    };
    
    processCurrentLayerData();
    return () => { isMounted = false; };
  }, [data]);

  const resolvedHeight = Math.min(Math.max(height, MIN_HEIGHT), MAX_HEIGHT);
  const offcanvasWidth = mapRect ? `${mapRect.width}px` : "100vw";
  const offcanvasLeft = mapRect ? `${mapRect.left}px` : "0";
  const offcanvasRight = mapRect ? "auto" : "0";
  const offcanvasMargin = mapRect ? "0" : "0 auto";

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="bottom"
      container={portalTarget}
      style={{
        '--bs-offcanvas-height': `${resolvedHeight}px`,
        height: 'auto',
        top: 'auto',
        bottom: 0,
        zIndex: 12000, // ensure above map + UI chrome
        background: "rgba(10, 36, 99, 0.95)", // Dark blue, semi-transparent
        backdropFilter: "blur(8px)",
        color: "#e2e8f0", // Light text color for readability
        overflow: "hidden",
        transition: "height 0.1s",
        borderTop: `1px solid rgba(144, 224, 239, 0.3)`, // Subtle cyan border
        left: offcanvasLeft,
        right: offcanvasRight,
        width: offcanvasWidth,
        margin: offcanvasMargin,
        maxHeight: "90vh",
        
      }}
      backdrop={false}
      scroll={true}
    >
      {/* Drag Handle */}
      <div
        style={{
          height: 12,
          cursor: "ns-resize",
          background: "rgba(255, 255, 255, 0.1)",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          textAlign: "center",
          userSelect: "none",
          margin: "-8px 0 0 0",
        }}
        onMouseDown={onMouseDown}
        title="Drag to resize"
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "rgba(255, 255, 255, 0.4)",
            borderRadius: 2,
            margin: "4px auto",
          }}
        />
      </div>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        borderBottom: `1px solid rgba(144, 224, 239, 0.2)`, 
        padding: "0 1rem 0 0.5rem" 
      }}>
        {/* Custom CSS Tabs */}
        <div style={{ display: "flex", flex: 1, paddingTop: 10 }}>
          {tabLabels.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid #90e0ef` : "2px solid transparent",
                background: "none",
                padding: "8px 20px",
                marginRight: 8,
                fontWeight: activeTab === tab.key ? "600" : "400",
                color: activeTab === tab.key ? "#90e0ef" : "#cbd5e1",
                cursor: "pointer",
                fontSize: 16,
                transition: "border-bottom 0.1s"
              }}
              aria-controls={`tab-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onHide}
          type="button"
          aria-label="Close"
          style={{
            border: "none",
            background: "none",
            fontSize: 26,
            marginLeft: 8,
            color: "#94a3b8",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <Offcanvas.Body style={{ paddingTop: 16 }}>
        {loading
          ? <div style={{ textAlign: "center", padding: "2rem" }}>Loading data...</div>
          : fetchError
              ? <div style={{ color: "red", textAlign: "center" }}>{fetchError}</div>
              : <>
                  <div style={{ display: activeTab === 'tabular' ? 'block' : 'none' }}><Tabular perVariableData={perVariableData} /></div>
                  <div style={{ display: activeTab === 'timeseries' ? 'block' : 'none' }}><Timeseries perVariableData={perVariableData} /></div>
                  {/*
                    Conditionally mount MapPreview ONLY when its tab is active.
                    Returning null ensures the component is fully unmounted, preventing Leaflet instance conflicts.
                  */}
                  {activeTab === 'map' ? <MapPreview data={data} /> : null}
                </>
        }
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default BottomOffCanvas;
