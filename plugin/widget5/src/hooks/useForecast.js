import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import wmsStyleManager, { WMSStylePresets } from '../utils/WMSStyleManager';
import { fetchLayerMinMax } from '../utils/WMSMetadataClient';

function formatDateISOString(date) {
  return date.toISOString().split(".")[0] + ".000Z";
}

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

function getStepHours(stepStr) {
  if (!stepStr?.startsWith("PT") || !stepStr.endsWith("H")) return 1;
  return parseInt(stepStr.substring(2, stepStr.length - 1), 10) || 1;
}

const WAVE_HEIGHT_THRESHOLDS = Object.keys(WMSStylePresets.WAVE_HEIGHT.colorMapping)
  .map(Number)
  .sort((a, b) => a - b);

const EPSILON = 1e-6;
const DEFAULT_BEAUFORT_VISUAL_MAX = 4;

function getLayerUnit(layerValue) {
  if (!layerValue) return '';
  if (layerValue.includes('hs')) return 'm';
  if (layerValue.includes('tm02') || layerValue.includes('tpeak')) return 's';
  if (layerValue.includes('dir')) return '°';
  return '';
}

function getBeaufortCeiling(value) {
  if (!Number.isFinite(value)) {
    return WAVE_HEIGHT_THRESHOLDS[WAVE_HEIGHT_THRESHOLDS.length - 1];
  }
  const adjusted = Math.max(0, value);
  for (const threshold of WAVE_HEIGHT_THRESHOLDS) {
    if (adjusted <= threshold + EPSILON) {
      return threshold;
    }
  }
  return WAVE_HEIGHT_THRESHOLDS[WAVE_HEIGHT_THRESHOLDS.length - 1];
}

function parseRangeMax(rangeString) {
  if (!rangeString) return null;
  const parts = rangeString.split(',');
  if (parts.length !== 2) return null;
  const max = Number(parts[1]);
  return Number.isFinite(max) ? max : null;
}

function cloneLayerConfig(layer) {
  if (!layer) return layer;
  if (layer.composite && Array.isArray(layer.layers)) {
    return {
      ...layer,
      layers: layer.layers.map(cloneLayerConfig)
    };
  }
  const cloned = { ...layer };
  if (cloned.value && cloned.value.includes('hs')) {
    const initialMax = parseRangeMax(cloned.colorscalerange);
    const visualMax = getBeaufortCeiling(
      initialMax !== null ? Math.min(initialMax, DEFAULT_BEAUFORT_VISUAL_MAX) : DEFAULT_BEAUFORT_VISUAL_MAX
    );
    cloned.activeBeaufortMax = visualMax;
    cloned.colorscalerange = `0,${visualMax}`;
    cloned.legendUrl = wmsStyleManager.getEnhancedLegendUrl(
      cloned.value,
      cloned.colorscalerange,
      getLayerUnit(cloned.value)
    );
  } else {
    const initialMax = parseRangeMax(cloned.colorscalerange);
    if (initialMax !== null) {
      cloned.activeBeaufortMax = initialMax;
    }
  }
  return cloned;
}

function isScalarLayer(layerConfig) {
  if (!layerConfig) return false;
  const value = layerConfig.value || layerConfig.layer;
  return typeof value === 'string' && !value.includes('dirm');
}

function findLayerByValue(layers, value) {
  if (!Array.isArray(layers)) return null;
  for (const layer of layers) {
    if (layer?.value === value) return layer;
    if (layer?.composite) {
      const match = findLayerByValue(layer.layers, value);
      if (match) return match;
    }
  }
  return null;
}

function applyRangeToLayers(layers, targetValue, update = {}) {
  return layers.map(layer => {
    if (layer.composite && Array.isArray(layer.layers)) {
      return {
        ...layer,
        layers: applyRangeToLayers(layer.layers, targetValue, update)
      };
    }

    if (layer.value !== targetValue) {
      return layer;
    }

    return {
      ...layer,
      ...update
    };
  });
}

function normalizeRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.05, 0.1);
    return {
      min: min - padding,
      max: max + padding,
    };
  }

  if (min > max) {
    return { min: max, max: min };
  }

  return { min, max };
}

export const useForecast = (config) => {
  const { WAVE_FORECAST_LAYERS, STATIC_LAYERS, WAVE_BUOYS, bounds, addWMSTileLayer } = config;

  // State management
  const [showBuoyCanvas, setShowBuoyCanvas] = useState(false);
  const [showBottomCanvas, setShowBottomCanvas] = useState(false);
  const [bottomCanvasData, setBottomCanvasData] = useState(null);
  const [selectedBuoyId, setSelectedBuoyId] = useState(null);
  const [sidebarPosition, setSidebarPosition] = useState({ x: 24, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [useModernUI, setUseModernUI] = useState(true);
  const [modernPanelCollapsed, setModernPanelCollapsed] = useState(window.innerWidth <= 768);
  const [activeLayers, setActiveLayers] = useState({ waveForecast: true, "stamen-toner": true });
  const [selectedWaveForecast, setSelectedWaveForecast] = useState(WAVE_FORECAST_LAYERS[0]?.value || '');
  const [capTime, setCapTime] = useState({ loading: true, start: new Date(), end: new Date(), stepHours: 1 });
  const [sliderIndex, setSliderIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wmsOpacity, setWmsOpacity] = useState(1);
  const [dynamicLayers, setDynamicLayers] = useState(() => WAVE_FORECAST_LAYERS.map(cloneLayerConfig));
  const [isUpdatingVisualization, setIsUpdatingVisualization] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const shouldCollapse = window.innerWidth <= 768;
      setModernPanelCollapsed(prev => (prev === shouldCollapse ? prev : shouldCollapse));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const baseLayerSnapshot = useMemo(
    () => WAVE_FORECAST_LAYERS.map(cloneLayerConfig),
    [WAVE_FORECAST_LAYERS]
  );

  useEffect(() => {
    setDynamicLayers(baseLayerSnapshot.map(cloneLayerConfig));
  }, [baseLayerSnapshot]);

  // Refs
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerRefs = useRef({});
  const wmsLayerGroup = useRef(null);
  const wmsLayerRefs = useRef([]);
  const buoyMarkersRef = useRef([]);
  const sidebarRef = useRef(null);
  const playTimer = useRef(null);
  const legendControlRef = useRef(null);
  const legendContainerRef = useRef(null);
  const initialSliderIndexSet = useRef(false);

  // Canvas handlers
  const openBottomCanvas = (data) => {
    setShowBottomCanvas(true);
    setShowBuoyCanvas(false);
    setBottomCanvasData(data);
  };
  const openBuoyCanvas = (buoyId) => {
    setShowBottomCanvas(false);
    setShowBuoyCanvas(true);
    setSelectedBuoyId(buoyId);
  };
  const handleShow = useCallback((info) => {
    openBottomCanvas(info);
  }, []);

  // Sidebar drag handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.accordion-button, .form-check, select, button, input')) return;
    setIsDragging(true);
    const rect = sidebarRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    const maxX = window.innerWidth - 400;
    const maxY = window.innerHeight - 200;
    setSidebarPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(60, Math.min(newY, maxY))
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Fetch WMS capabilities
  useEffect(() => {
    async function fetchCapabilities() {
      setCapTime((prev) => ({ ...prev, loading: true }));
      try {
        // Find layer in forecast layers first, then static layers
        let selectedLayer = WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);
        if (!selectedLayer) {
          selectedLayer = STATIC_LAYERS.find(l => l.value === selectedWaveForecast);
        }
        
        // Skip capabilities fetch for static layers
        if (selectedLayer?.isStatic) {
          setCapTime({
            loading: false,
            start: new Date(),
            end: new Date(),
            stepHours: 1
          });
          return;
        }
        
        const capsLayer = selectedLayer?.composite ? selectedLayer.layers[0] : selectedLayer;
        if (!capsLayer?.wmsUrl) throw new Error("WMS URL not defined for layer.");
        
        let urlForCaps = capsLayer.wmsUrl;
        if (!urlForCaps.toLowerCase().includes("request=getcapabilities")) {
          urlForCaps += (urlForCaps.includes("?") ? "&" : "?") + "SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0";
        }
        
        const res = await fetch(urlForCaps);
        const xml = await res.text();
        const timeDim = parseTimeDimensionFromCapabilities(xml, capsLayer.value);
        if (!timeDim) throw new Error("No time dimension found in capabilities.");
        
        const { start, end, step } = getTimeRangeFromDimension(timeDim.raw) || {};
        const stepHours = getStepHours(step);
        const newTotalSteps = !start || !end ? 0 : Math.max(0, Math.floor((end - start) / (stepHours * 60 * 60 * 1000)));
        
        setCapTime({ loading: false, start, end, stepHours });

        let preferredIndex = 1;

        if (newTotalSteps >= 1 && preferredIndex <= 0) {
          preferredIndex = Math.min(1, newTotalSteps);
        }

        setSliderIndex(prevIndex => {
          if (newTotalSteps <= 0) {
            return 0;
          }

          if (!initialSliderIndexSet.current) {
            initialSliderIndexSet.current = true;
            return preferredIndex;
          }

          if (prevIndex > newTotalSteps) {
            return newTotalSteps;
          }

          return prevIndex;
        });
      } catch (e) {
        console.error("Failed to fetch WMS capabilities:", e);
        setCapTime((prev) => ({ ...prev, loading: false }));
      }
    }
    if (selectedWaveForecast) {
        fetchCapabilities();
    }
  }, [selectedWaveForecast, WAVE_FORECAST_LAYERS, STATIC_LAYERS]);

  // Derived time state
  const totalSteps = capTime.loading || !capTime.start || !capTime.end ? 0 : Math.max(0, Math.floor((capTime.end - capTime.start) / (capTime.stepHours * 60 * 60 * 1000)));
  
  const currentSliderDate = useMemo(() => 
    capTime.loading || !capTime.start ? new Date() : new Date(capTime.start.getTime() + sliderIndex * capTime.stepHours * 60 * 60 * 1000),
    [capTime.loading, capTime.start, capTime.stepHours, sliderIndex]
  );
  const currentSliderDateStr = useMemo(() => formatDateISOString(currentSliderDate), [currentSliderDate]);

  useEffect(() => {
    if (capTime.loading || !selectedWaveForecast) {
      return;
    }

    const baseLayer = findLayerByValue(baseLayerSnapshot, selectedWaveForecast);
    const forecastKey = (selectedWaveForecast || '').toLowerCase();
    if (!forecastKey.includes('hs')) {
      setDynamicLayers(baseLayerSnapshot.map(cloneLayerConfig));
      setIsUpdatingVisualization(false);
      return;
    }
    if (!baseLayer || !baseLayer.wmsUrl || !isScalarLayer(baseLayer)) {
      if (baseLayer) {
        const fallbackMax = getBeaufortCeiling(parseRangeMax(baseLayer.colorscalerange));
        setDynamicLayers(prev => applyRangeToLayers(prev, selectedWaveForecast, {
          colorscalerange: baseLayer.colorscalerange,
          legendUrl: baseLayer.legendUrl,
          activeBeaufortMax: fallbackMax
        }));
      } else {
        setDynamicLayers(baseLayerSnapshot.map(cloneLayerConfig));
      }
      setIsUpdatingVisualization(false);
      return;
    }

    let cancelled = false;

    const mapBoundsArray = bounds
      ? [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
      : undefined;

    const updateFromMetadata = async () => {
      setIsUpdatingVisualization(true);
      try {
        const { min, max } = await fetchLayerMinMax(
          baseLayer.wmsUrl,
          selectedWaveForecast,
          currentSliderDateStr,
          mapBoundsArray
        );

        if (cancelled) return;

        const normalized = normalizeRange(min, max);
        if (!normalized) {
          throw new Error('Invalid min/max metadata payload');
        }

        const targetMax = getBeaufortCeiling(normalized.max);
        const rangeString = `0,${targetMax}`;
        const legendUrl = wmsStyleManager.getEnhancedLegendUrl(
          selectedWaveForecast,
          rangeString,
          getLayerUnit(selectedWaveForecast)
        );

        setDynamicLayers(prevLayers => applyRangeToLayers(prevLayers, selectedWaveForecast, {
          colorscalerange: rangeString,
          legendUrl,
          activeBeaufortMax: targetMax
        }));
      } catch (error) {
        console.warn('WMS min/max metadata request failed:', error);

        if (!cancelled) {
          const fallbackLayer = findLayerByValue(baseLayerSnapshot, selectedWaveForecast);
          if (fallbackLayer) {
            const fallbackMax = getBeaufortCeiling(
              Math.min(
                parseRangeMax(fallbackLayer.colorscalerange) ?? DEFAULT_BEAUFORT_VISUAL_MAX,
                DEFAULT_BEAUFORT_VISUAL_MAX
              )
            );
            const fallbackRange = `0,${fallbackMax}`;
            const legendUrl = wmsStyleManager.getEnhancedLegendUrl(
              selectedWaveForecast,
              fallbackRange,
              getLayerUnit(selectedWaveForecast)
            );
            setDynamicLayers(prevLayers => applyRangeToLayers(prevLayers, selectedWaveForecast, {
              colorscalerange: fallbackRange,
              legendUrl,
              activeBeaufortMax: fallbackMax
            }));
          } else {
            setDynamicLayers(baseLayerSnapshot.map(cloneLayerConfig));
          }
        }
      } finally {
        if (!cancelled) {
          setIsUpdatingVisualization(false);
        }
      }
    };

    const timeoutId = window.setTimeout(updateFromMetadata, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    baseLayerSnapshot,
    bounds,
    capTime.loading,
    currentSliderDateStr,
    selectedWaveForecast
  ]);

  // Map initialization
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      const map = L.map(mapRef.current);
      map.fitBounds(bounds);
      mapInstance.current = map;

      const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; OpenStreetMap' });
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' });
      
      satelliteLayer.addTo(map); // Set satellite as the default layer
      layerRefs.current.satellite = satelliteLayer;
      
      wmsLayerGroup.current = L.layerGroup().addTo(map);

      const baseMaps = { "OpenStreetMap": osmLayer, "Satellite": satelliteLayer };
      const overlayMaps = { "Wave Forecast": wmsLayerGroup.current };
      L.control.layers(baseMaps, overlayMaps).addTo(map);

      // Add zoom control (already present by default, reposition if needed)
      if (map.zoomControl) {
        map.zoomControl.setPosition('topleft');
      }

      // Add scale control to provide distance reference
      L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);
      
      // Map legend is rendered via the in-app world-class legend component; remove Leaflet image legend
      legendControlRef.current = null;
      legendContainerRef.current = null;
    }
    return () => {
      if (mapInstance.current) {
        legendContainerRef.current = null;
        legendControlRef.current = null;
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [bounds]);

  // WMS Layer updates
  useEffect(() => {
    if (!mapInstance.current || !wmsLayerGroup.current || capTime.loading) return;
    
    wmsLayerGroup.current.clearLayers();
    wmsLayerRefs.current = [];

    if (!activeLayers.waveForecast) return;

    // Check dynamic layers first, then static layers
    let selected = dynamicLayers.find(l => l.value === selectedWaveForecast);
    if (!selected) {
      selected = STATIC_LAYERS.find(l => l.value === selectedWaveForecast);
    }
    if (!selected) return;

    const layersToAdd = selected.composite ? selected.layers : [selected];
    const isTimeDimensionless = selected.isStatic || selected.id === 200;

    layersToAdd.forEach(layerConfig => {
      let wmsLayer;
      const commonOptions = {
        layers: layerConfig.value,
        format: "image/png",
        transparent: true,
        opacity: wmsOpacity,
        styles: layerConfig.style,
        version: '1.3.0',
        DATASET: layerConfig.dataset || 'cook_forecast', // Support non-forecast datasets
        crs: L.CRS.EPSG4326, // Force EPSG:4326 for ncWMS compatibility
        pane: 'overlayPane', // Ensure WMS layer is on top of base maps
      };

      // Only add time parameter for time-dimensional layers
      if (!isTimeDimensionless && currentSliderDateStr) {
        commonOptions.time = currentSliderDateStr;
      }

      // Use addWMSTileLayer for all layers to ensure consistent getFeatureInfo functionality
      wmsLayer = addWMSTileLayer(
        mapInstance.current,
        layerConfig.wmsUrl,
        {
          ...commonOptions,
          colorscalerange: layerConfig.colorscalerange || "",
          abovemaxcolor: layerConfig.value === 'dirm' ? "transparent" : "extend",
          belowmincolor: "transparent",
          numcolorbands: layerConfig.numcolorbands || "250",
        },
        handleShow
      );
      wmsLayerGroup.current.addLayer(wmsLayer);
      wmsLayerRefs.current.push(wmsLayer);
    });

  }, [activeLayers.waveForecast, selectedWaveForecast, handleShow, currentSliderDateStr, capTime.loading, wmsOpacity, dynamicLayers, STATIC_LAYERS, addWMSTileLayer]);

  // Playback timer
  useEffect(() => {
    let animationFrameId;
    if (isPlaying && !capTime.loading) {
      const findNextValidIndex = (currentIndex) => {
        let nextIndex = (currentIndex + 1) % (totalSteps + 1);  // Loop back to 0
        let attempts = 0;
        while (attempts <= totalSteps) {
          const nextDate = new Date(capTime.start.getTime() + (nextIndex) * capTime.stepHours * 60 * 60 * 1000);
          const nextDateStr = formatDateISOString(nextDate);
          console.log("Checking Slider Index=" + nextIndex + " Date=" + nextDateStr);
          if (nextDateStr) {
             console.log("Valid index found: " + nextIndex);
             return nextIndex;
           }
          nextIndex = (nextIndex + 1) % (totalSteps + 1);
           attempts++;
        }
        return currentIndex; // If no valid index is found, return the current index to stop the loop
      };

      playTimer.current = setInterval(() => {
        animationFrameId = requestAnimationFrame(() => {
          setSliderIndex((prev) => findNextValidIndex(prev));
        });
      }, 1000);

    } else {
      clearInterval(playTimer.current);
       cancelAnimationFrame(animationFrameId);
    }
    return () => clearInterval(playTimer.current);

  }, [isPlaying, capTime.loading, totalSteps, capTime.start, capTime.stepHours, setSliderIndex]);





  // Buoy markers
  useEffect(() => {
    if (!mapInstance.current || !WAVE_BUOYS) return;
    
    buoyMarkersRef.current.forEach(marker => marker.remove());
    buoyMarkersRef.current = [];

    if (activeLayers["stamen-toner"]) {
        const blueIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
        const greenIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

        buoyMarkersRef.current = WAVE_BUOYS.map(buoy => {
            const isSpecial = buoy.id === "SPOT-31091C";
            const marker = L.marker([buoy.lat, buoy.lon], {
                title: buoy.id,
                icon: isSpecial ? greenIcon : blueIcon,
                zIndexOffset: 1000,
            }).addTo(mapInstance.current);

            marker.bindPopup(`<b>${buoy.id}</b><br>Lat: ${buoy.lat}<br>Lon: ${buoy.lon}`);
            marker.on("click", (e) => {
                e.originalEvent.stopPropagation();
                openBuoyCanvas(buoy.id);
            });
            return marker;
        });
    }

    return () => {
        buoyMarkersRef.current.forEach(marker => marker.remove());
        buoyMarkersRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers["stamen-toner"], WAVE_BUOYS, openBuoyCanvas]);

  // Update the Leaflet legend whenever the selected layer or dynamic styling changes
  useEffect(() => {
    if (!legendContainerRef.current) return;

    const container = legendContainerRef.current;
    container.innerHTML = '';

    const findLayerConfig = (layers) => {
      if (!Array.isArray(layers)) return null;
      for (const layer of layers) {
        if (layer?.value === selectedWaveForecast) {
          return layer;
        }
        if (layer?.composite && Array.isArray(layer.layers)) {
          const match = layer.layers.find(subLayer => subLayer?.value === selectedWaveForecast);
          if (match) return match;
        }
      }
      return null;
    };

    const dynamicLayer = findLayerConfig(dynamicLayers);
    // Try to find in forecast layers first, then static layers
    let fallbackLayer = findLayerConfig(WAVE_FORECAST_LAYERS);
    if (!fallbackLayer) {
      fallbackLayer = findLayerConfig(STATIC_LAYERS);
    }
    const layerConfig = dynamicLayer || fallbackLayer;

    if (layerConfig?.legendUrl) {
      const legendImg = document.createElement('img');
      legendImg.src = layerConfig.legendUrl;
      legendImg.alt = `Legend for ${layerConfig.label || layerConfig.value || 'selected layer'}`;
      legendImg.className = 'forecast-map-legend__image';
      container.appendChild(legendImg);

      if (layerConfig.label) {
        const caption = document.createElement('div');
        caption.className = 'forecast-map-legend__caption';
        caption.textContent = layerConfig.label;
        container.appendChild(caption);
      }
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'legend-placeholder';
      placeholder.textContent = 'Legend unavailable for this layer';
      container.appendChild(placeholder);
    }
  }, [dynamicLayers, selectedWaveForecast, WAVE_FORECAST_LAYERS, STATIC_LAYERS]);

  return {
    // State
    showBuoyCanvas, setShowBuoyCanvas,
    showBottomCanvas, setShowBottomCanvas,
    bottomCanvasData, setBottomCanvasData,
    selectedBuoyId,
    sidebarPosition,
    isDragging,
    useModernUI, setUseModernUI,
    modernPanelCollapsed, setModernPanelCollapsed,
    activeLayers, setActiveLayers,
    selectedWaveForecast, setSelectedWaveForecast,
    capTime,
    sliderIndex, setSliderIndex,
    isPlaying, setIsPlaying,
    wmsOpacity, setWmsOpacity,
    dynamicLayers,
    isUpdatingVisualization,
    // Refs
    mapRef,
    mapInstance,
    sidebarRef,
    // Handlers
    handleMouseDown,
    // Derived values
    totalSteps,
    currentSliderDate,
    currentSliderDateStr,
    // Config
    WAVE_FORECAST_LAYERS,
  };
};
