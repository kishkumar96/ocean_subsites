import React, { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Accordion, Form } from "react-bootstrap";
import addCookWMSTileLayer from "../components/addCookWMSTileLayer";
import CookWaveForecastAccordion from "../components/CookWaveForecastAccordion";
import { createWMSCapabilitiesUrl } from "../utils/wmsUtils";
import { getProxyWmsUrl } from "../utils/wmsProxy";
import { 
  COOK_ISLANDS_CONFIG, 
  COOK_WAVE_FORECAST_LAYERS, 
  COOK_WAVE_STATIONS
} from "../config/cookIslandsConfig";

const widgetContainerStyle = {
  position: "relative",
  width: "100%",
  height: "calc(100vh - 60px)",
  overflow: "hidden",
};

function getFloatingSidebarStyle(position, isDragging) {
  return {
    position: "absolute",
    top: `${position.y}px`,
    left: `${position.x}px`,
    width: "min(370px, 90vw)",
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border, #e2e8f0)",
    borderRadius: "8px",
    boxShadow: "var(--card-shadow)",
    zIndex: 1000,
    maxHeight: "calc(100vh - 120px)",
    overflowY: "auto",
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none",
  };
}

// Time parsing functions
function parseTimeDimensionFromCapabilities(xml, layerName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const layers = doc.getElementsByTagName("Layer");
  
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const nameEl = layer.getElementsByTagName("Name")[0];
    if (nameEl && nameEl.textContent === layerName) {
      const dimensions = layer.getElementsByTagName("Dimension");
      for (let j = 0; j < dimensions.length; j++) {
        const dim = dimensions[j];
        if (dim.getAttribute("name") === "time") {
          return dim.textContent.trim();
        }
      }
    }
  }
  return null;
}

function getTimeRangeFromDimension(dimStr) {
  if (!dimStr) return null;
  const parts = dimStr.split("/");
  if (parts.length >= 2) {
    const start = new Date(parts[0]);
    const end = new Date(parts[1]);
    const step = parts[2] || "PT1H";
    return { start, end, step };
  }
  return null;
}

function getStepHours(stepStr) {
  if (!stepStr) return 1;
  const match = stepStr.match(/PT(\d+)H/);
  return match ? parseInt(match[1], 10) : 1;
}

function formatDateISOString(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function CookIslandsForecast() {
  console.log('CookIslandsForecast component loading...');
  
  const [sidebarPosition, setSidebarPosition] = useState({ x: 24, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerRefs = useRef({});
  const wmsLayerGroup = useRef(null);
  const wmsLayerRefs = useRef([]);
  const stationMarkersRef = useRef([]);
  const sidebarRef = useRef(null);

  const [activeLayers, setActiveLayers] = useState({
    osm: true,
    stations: true,
    waveForecast: true, // Start with wave forecast active
  });
  
  const [selectedWaveForecast, setSelectedWaveForecast] = useState(COOK_WAVE_FORECAST_LAYERS[0]?.value || "");

  const [capTime, setCapTime] = useState({
    loading: true,
    start: new Date("2025-09-10T12:00:00.000Z"),
    end: new Date("2025-09-20T00:00:00.000Z"),
    stepHours: 1
  });
  
  const [sliderIndex, setSliderIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimer = useRef(null);
  const [wmsOpacity, setWmsOpacity] = useState(1);

  // Only one bottom canvas open at once (placeholder for future implementation):
  const openBottomCanvas = (data) => {
    console.log("Cook Islands forecast data:", data);
    // TODO: Implement canvas for detailed data display
  };

  const handleShow = useCallback((info) => openBottomCanvas(info), []);

  // Drag handlers for sidebar
  const handleMouseDown = (e) => {
    if (e.target.closest('.accordion-button') || 
        e.target.closest('.form-check') || 
        e.target.closest('.form-select') ||
        e.target.closest('.form-range') ||
        e.target.closest('.btn') ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'BUTTON') {
      return; // Don't start drag if clicking on interactive elements
    }
    
    setIsDragging(true);
    const rect = sidebarRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  const handleMouseMove = React.useCallback((e) => {
    if (!isDragging) return;
    
    const newX = Math.max(0, Math.min(window.innerWidth - 370, e.clientX - dragOffset.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y));
    
    setSidebarPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove]);

  // Fetch capabilities for time dimension (using wave forecast data)
  useEffect(() => {
    async function fetchCapabilities() {
      setCapTime((prev) => ({ ...prev, loading: true }));
      try {
        let selectedLayer, capsLayer;
        
        // Use wave forecast to get capabilities
        if (activeLayers.waveForecast && selectedWaveForecast) {
          selectedLayer = COOK_WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);
        }
        
        if (!selectedLayer) return;
        
        capsLayer = selectedLayer?.composite ? selectedLayer.layers[0] : selectedLayer;
        let url = capsLayer?.wmsUrl;
        let urlForCaps = createWMSCapabilitiesUrl(getProxyWmsUrl(url));
        console.log('Fetching capabilities from:', urlForCaps);
        
        const layerName = capsLayer?.value;
        const res = await fetch(urlForCaps);
        console.log('Capabilities response:', res.status, res.statusText);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const xml = await res.text();
        console.log('Capabilities XML length:', xml.length);
        
        const timeDim = parseTimeDimensionFromCapabilities(xml, layerName);
        console.log('Time dimension found:', timeDim);
        
        if (!timeDim) throw new Error("No time dimension found in capabilities.");
        
        const { start, end, step } = getTimeRangeFromDimension(timeDim) || {};
        const stepHours = getStepHours(step || "PT1H");
        console.log('Time range:', { start, end, stepHours });
        
        setCapTime({
          loading: false,
          start,
          end,
          stepHours
        });
        setSliderIndex(0);
      } catch (e) {
        console.error("Error fetching Cook Islands capabilities:", e);
        setCapTime((prev) => ({ ...prev, loading: false }));
      }
    }
    
    // Fetch capabilities when wave forecast is active
    if (selectedWaveForecast && activeLayers.waveForecast) {
      fetchCapabilities();
    }
  }, [selectedWaveForecast, activeLayers.waveForecast]);

  const totalSteps = Math.floor((capTime.end - capTime.start) / (capTime.stepHours * 60 * 60 * 1000));
  const currentSliderDate = new Date(capTime.start.getTime() + sliderIndex * capTime.stepHours * 60 * 60 * 1000);
  const currentSliderDateStr = formatDateISOString(currentSliderDate);

  // Ref to hold latest time string so map click handler doesn't need re-binding
  const currentTimeRef = useRef(currentSliderDateStr);
  useEffect(() => {
    currentTimeRef.current = currentSliderDateStr;
  }, [currentSliderDateStr]);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      const bounds = L.latLngBounds(
        L.latLng(COOK_ISLANDS_CONFIG.bounds.southWest[0], COOK_ISLANDS_CONFIG.bounds.southWest[1]),
        L.latLng(COOK_ISLANDS_CONFIG.bounds.northEast[0], COOK_ISLANDS_CONFIG.bounds.northEast[1])
      );
      
      mapInstance.current = L.map(mapRef.current, { zoomControl: false });
      mapInstance.current.setView([-21.2292, -159.7777], 9); // Define Rarotonga center and zoom level
      // mapInstance.current.fitBounds(bounds); // <- removed fitBounds call

      // Map click handler - ONLY CALL FIRST ACTIVE WMS LAYER
      mapInstance.current.on("click", (e) => {
        console.log("Cook Islands map clicked at:", e.latlng);
        
        // Check if any WMS layers should handle this click - ONLY THE FIRST ONE
        if (wmsLayerRefs.current && wmsLayerRefs.current.length > 0) {
          const firstActiveLayer = wmsLayerRefs.current[0];
          if (firstActiveLayer && firstActiveLayer.getFeatureInfo) {
            console.log("WMS layer found, handling click with first layer only");
            firstActiveLayer.getFeatureInfo(e.latlng);
            return; // Exit early - don't call openBottomCanvas
          }
        }
        
        console.log("No WMS layer handled click, doing general map click");
        
        // Convert latlng to WMS parameters for GetFeatureInfo
        const map = mapInstance.current;
        const point = map.latLngToContainerPoint(e.latlng);
        const size = map.getSize();
        
        // Create a small bbox around the clicked point
        const bboxSize = 0.01; // About 1km at the equator
        const bbox = [
          e.latlng.lng - bboxSize/2,
          e.latlng.lat - bboxSize/2,
          e.latlng.lng + bboxSize/2,
          e.latlng.lat + bboxSize/2
        ].join(',');
        
        const wmsData = {
          latlng: e.latlng,
          bbox: bbox,
          x: Math.round(point.x),
          y: Math.round(point.y),
          width: size.x,
          height: size.y,
          timeDimension: currentTimeRef.current
        };
        
        openBottomCanvas(wmsData);
      });

      const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
        detectRetina: true,
      });
      osmLayer.addTo(mapInstance.current);
      layerRefs.current.osm = osmLayer;

      // Create WMS layer group
      wmsLayerGroup.current = L.layerGroup().addTo(mapInstance.current);
    }
    return () => {
      if (mapInstance.current) {
        mapInstance.current.off("click");
        mapInstance.current.remove();
        mapInstance.current = null;
        layerRefs.current = {};
        wmsLayerGroup.current = null;
        wmsLayerRefs.current = [];
      }
      if (playTimer.current) {
        clearInterval(playTimer.current);
      }
    };
  }, []);

  // Handle base layers
  useEffect(() => {
    if (!mapInstance.current) return;
    if (activeLayers.osm && !layerRefs.current.osm) {
      const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
        detectRetina: true,
      });
      osmLayer.addTo(mapInstance.current);
      layerRefs.current.osm = osmLayer;
    } else if (!activeLayers.osm && layerRefs.current.osm) {
      mapInstance.current.removeLayer(layerRefs.current.osm);
      layerRefs.current.osm = null;
    }
  }, [activeLayers]);

  // Handle WMS wave forecast layers
  useEffect(() => {
    console.log('WMS layer effect triggered:', {
      mapReady: !!mapInstance.current,
      capTimeLoading: capTime.loading,
      waveLayerActive: activeLayers.waveForecast,
      selectedLayer: selectedWaveForecast,
      capTime: capTime
    });
    
    if (!mapInstance.current || capTime.loading) return;
    if (!activeLayers.waveForecast || !selectedWaveForecast) {
      // remove existing
      if (wmsLayerRefs.current) {
        wmsLayerRefs.current.forEach(l => l && mapInstance.current.removeLayer(l));
        wmsLayerRefs.current = [];
      }
      return;
    }

    const selected = COOK_WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);
    console.log('Selected WMS layer:', selected);
    if (!selected) return;

    // Create once if empty
    if (wmsLayerRefs.current.length === 0) {
      console.log('Creating new WMS layers...');
      if (selected.composite) {
        console.log('Creating composite layer with sublayers:', selected.layers);
        const newLayers = selected.layers.map(sub =>
          addCookWMSTileLayer(mapInstance.current, sub.wmsUrl, {
            id: sub.id,
            layers: sub.value,
            format: 'image/png',
            transparent: true,
            opacity: wmsOpacity,
            styles: sub.style,
            colorscalerange: sub.colorscalerange,
            abovemaxcolor: 'extend',
            belowmincolor: 'transparent',
            numcolorbands: sub.numcolorbands || '250',
            time: currentSliderDateStr
          }, handleShow)
        );
        wmsLayerRefs.current = newLayers; // Keep all layers, don't overwrite
        console.log('Created', newLayers.length, 'composite layers');
      } else {
        console.log('Creating single layer:', selected.value);
        const lyr = addCookWMSTileLayer(mapInstance.current, selected.wmsUrl, {
          id: selected.id,
          layers: selected.value,
          format: 'image/png',
          transparent: true,
          opacity: wmsOpacity,
          styles: selected.style,
          colorscalerange: selected.colorscalerange,
          abovemaxcolor: 'extend',
          belowmincolor: 'transparent',
          numcolorbands: selected.numcolorbands || '250',
          time: currentSliderDateStr
        }, handleShow);
        wmsLayerRefs.current = [lyr];
        console.log('Created single WMS layer');
      }
    } else {
      console.log('Updating existing WMS layer params');
      // Just update params
      wmsLayerRefs.current.forEach(l => l && l.setParams && l.setParams({
        time: currentSliderDateStr,
        opacity: wmsOpacity
      }));
    }
  }, [activeLayers.waveForecast, selectedWaveForecast, currentSliderDateStr, wmsOpacity, capTime.loading, handleShow]);

  // Handle animation playback
  useEffect(() => {
    if (isPlaying && !capTime.loading) {
      playTimer.current = setInterval(() => {
        setSliderIndex((prev) =>
          prev < totalSteps ? prev + 1 : 0
        );
      }, 600);
    } else if (playTimer.current) {
      clearInterval(playTimer.current);
    }
    return () => {
      if (playTimer.current) {
        clearInterval(playTimer.current);
      }
    };
  }, [isPlaying, capTime.loading, totalSteps]);

  const blueIcon = React.useMemo(() => new L.Icon({
    iconUrl: '/blue_marker.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: undefined
  }), []);

  // Station markers
  useEffect(() => {
    if (!mapInstance.current) return;
    stationMarkersRef.current.forEach(marker => marker.remove());
    stationMarkersRef.current = [];
    if (!activeLayers.stations) return;

    console.log("Creating Cook Islands station markers...");

    stationMarkersRef.current = COOK_WAVE_STATIONS.map(station => {
      const marker = L.marker([station.lat, station.lng], {
        title: station.id,
        icon: blueIcon,
        zIndexOffset: 1000,
      }).addTo(mapInstance.current);

      marker.bindPopup(`<b>${station.name}</b><br>ID: ${station.id}<br>Type: ${station.type}<br>Lat: ${station.lat}<br>Lon: ${station.lng}`);
      marker.on("click", (e) => {
        console.log("Cook Islands station marker clicked:", station.id);
        e.originalEvent.stopPropagation();
        // TODO: Implement station data display
        openBottomCanvas({ stationId: station.id, station });
      });
      console.log("Created marker for station:", station.id);
      return marker;
    });
    return () => {
      stationMarkersRef.current.forEach(marker => marker.remove());
      stationMarkersRef.current = [];
    };
  }, [activeLayers.stations, blueIcon]); // REMOVED: mapInstance.current dependency

  const LayerAccordionHeader = ({ children, checked, onChange, eventKey }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        justifyContent: "flex-start",
        gap: 8
      }}
    >
      <Form.Check
        type="checkbox"
        id={`layer-toggle-${eventKey}`}
        checked={checked}
        onChange={onChange}
        label={null}
        style={{ marginLeft: 0, marginRight: 4 }}
        onClick={e => e.stopPropagation()}
      />
      <span>{children}</span>
    </div>
  );

  return (
    <div style={widgetContainerStyle}>
      <div 
        ref={sidebarRef}
        style={getFloatingSidebarStyle(sidebarPosition, isDragging)}
        onMouseDown={handleMouseDown}
      >
        <Accordion defaultActiveKey="layers">
          <Accordion.Item eventKey="layers">
            <Accordion.Header onClick={e => e.currentTarget.blur()}>Cook Islands Wave Forecast</Accordion.Header>
            <Accordion.Body>
              <CookWaveForecastAccordion
                active={!!activeLayers.waveForecast}
                onToggleActive={() =>
                  setActiveLayers(layers => ({ ...layers, waveForecast: !layers.waveForecast }))
                }
                COOK_WAVE_FORECAST_LAYERS={COOK_WAVE_FORECAST_LAYERS}
                selectedWaveForecast={selectedWaveForecast}
                setSelectedWaveForecast={setSelectedWaveForecast}
                opacity={wmsOpacity}
                setOpacity={setWmsOpacity}
                capTime={capTime}
                totalSteps={totalSteps}
                sliderIndex={sliderIndex}
                setSliderIndex={setSliderIndex}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                currentSliderDate={currentSliderDate}
              />
            </Accordion.Body>
          </Accordion.Item>
          
          {/* Monitoring Stations */}
          <Accordion.Item eventKey="stations">
            <Accordion.Header>
              <LayerAccordionHeader
                checked={!!activeLayers.stations}
                onChange={() => setActiveLayers(layers => ({ ...layers, stations: !layers.stations }))}
                eventKey="stations"
              >
                Monitoring Stations
              </LayerAccordionHeader>
            </Accordion.Header>
            <Accordion.Body>
              <div style={{ fontSize: "12px", color: "var(--color-text)" }}>
                <p>Cook Islands monitoring stations:</p>
                <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                  {COOK_WAVE_STATIONS.map(station => (
                    <li key={station.id}>{station.name} ({station.type})</li>
                  ))}
                </ul>
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </div>
      
      {/* Map container */}
      <div
        ref={mapRef}
        id="leaflet-fullscreen-map"
        style={{ 
          width: "100%", 
          height: "calc(100vh - 60px)", 
          position: "absolute",
          top: "0px",
          left: 0,
          zIndex: 1
        }}
      />
    </div>
  );
}

export default CookIslandsForecast;
