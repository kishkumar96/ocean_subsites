import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import './ForecastApp.css';
import WorldClassLegend from './WorldClassLegend';

const ForecastApp = ({ 
  WAVE_FORECAST_LAYERS,
  selectedWaveForecast,
  setSelectedWaveForecast,
  opacity,
  setOpacity,
  sliderIndex,
  setSliderIndex,
  totalSteps,
  isPlaying,
  setIsPlaying,
  currentSliderDate,
  capTime,
  activeLayers,
  setActiveLayers,
  mapRef,
  mapInstance,
  setBottomCanvasData,
  setShowBottomCanvas,
  isUpdatingVisualization,
  currentSliderDateStr
}) => {
  const [currentValue, setCurrentValue] = useState('Loading...');
  const [legendVisible, setLegendVisible] = useState(true);


  // Find selected layer configuration
  const selectedLayer = WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);

  // Generic function to extract units from a legend URL
  const getUnitsFromLegend = (url) => {
    if (!url) return '';
    const match = url.match(/unit=([^&]+)/);
    return match ? match[1] : '';
  };

  // Derive display info directly from the selected layer object
  const displayInfo = selectedLayer 
    ? { name: selectedLayer.label, units: getUnitsFromLegend(selectedLayer.legendUrl) }
    : { name: 'Unknown', units: '' };


  //Update current values
  useEffect(() => {
    const updateCurrentValue = () => {
      if (!selectedLayer) return;

       // Find the active WMS layer to query - look for layers with getFeatureInfo method
       const map = mapInstance?.current;
       if (!map || !activeLayers.waveForecast || !setBottomCanvasData) return;

       // Try to find the specific WMS layer for the selected forecast
       let wmsLayer = Object.values(map._layers).find(layer =>
         layer?.options?.layers === selectedWaveForecast && typeof layer.getFeatureInfo === 'function'
       );

       // Fallback 1: look for any WMS layer with getFeatureInfo method
       if (!wmsLayer) {
         wmsLayer = Object.values(map._layers).find(layer =>
           typeof layer.getFeatureInfo === 'function'
         );
       }

       // Fallback 2: if still no layer found, check if we have at least some layers loaded
       if (!wmsLayer) {
         const totalLayers = Object.keys(map._layers).length;
         if (totalLayers === 0) {
           setCurrentValue("Loading map...");
         } else {
           setCurrentValue("Loading data...");
         }
         return;
      }

       wmsLayer.getFeatureInfo(map.getCenter(), { autoShow: false })
         .then(data => {
           setCurrentValue(data?.featureInfo);
         })
         .catch(() => setCurrentValue("N/A"));
    };

      updateCurrentValue();
  }, [selectedLayer, sliderIndex, activeLayers.waveForecast, mapInstance, selectedWaveForecast, setBottomCanvasData, currentSliderDateStr]);

  // Effect to handle initial composite layer selection.
  // If the initially selected layer is a composite one (e.g., "Wave Height + Dir"),
  // this automatically switches the selection to its primary data sub-layer
  // to ensure a variable button is active in the UI.
  useEffect(() => {
    const initialLayer = WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);
    // If the initially selected layer is composite, find its primary data layer
    // and update the selection. This prevents trying to fetch capabilities for a
    // container layer that has no WMS URL.
    if (initialLayer?.composite) {
      const primaryLayer = initialLayer.layers?.find(l => l.wmsUrl); // Find first sub-layer with a URL
      if (primaryLayer && primaryLayer.value !== selectedWaveForecast) {
        setSelectedWaveForecast(primaryLayer.value);
      }
    }
  }, [selectedWaveForecast, setSelectedWaveForecast, WAVE_FORECAST_LAYERS]);

  const handleVariableChange = (layerValue) => {
    setSelectedWaveForecast(layerValue);
    setActiveLayers(prev => ({ ...prev, waveForecast: true }));
  };

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (value) => {
    setSliderIndex(parseInt(value));
  };

  const formatTime = (date) => {
    if (!date) return 'Loading...';
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Effect to handle map clicks for point sampling (GetFeatureInfo) - Enhanced to match widget1
  useEffect(() => {
    const map = mapInstance?.current;
    if (!map || !setBottomCanvasData) return;

    const handleMapClick = (e) => {
      console.log("Map clicked at:", e.latlng);
      
      // Check if any WMS layers should handle this click (matching widget1 approach)
      let wmsHandled = false;
      const allLayers = Object.values(map._layers);
      
      console.log("All layers on map:", allLayers);
      for (const layer of allLayers) {
        if (layer && layer.getFeatureInfo && typeof layer.getFeatureInfo === 'function') {
          console.log("WMS layer found, handling click");
          
          // Immediate feedback like Widget 1 - show "Loading..." immediately
          const point = map.latLngToContainerPoint(e.latlng);
          const size = map.getSize();
          const bbox = map.getBounds().toBBoxString();
          
          const loadingData = {
            latlng: e.latlng,
            bbox: bbox,
            x: Math.round(point.x),
            y: Math.round(point.y),
            width: size.x,
            height: size.y,
            timeDimension: currentSliderDate?.toISOString() || "",
            featureInfo: "Loading..."
          };
          
          // Show loading state immediately (like Widget 1)
          setBottomCanvasData(loadingData);
          setShowBottomCanvas(true);
          console.log("🚀 Immediately showing bottom canvas with loading state");
          
          // Then get the actual data
          layer.getFeatureInfo(e.latlng)
            .then(data => {
              setBottomCanvasData(data);
              console.log("GetFeatureInfo data updated:", data);
            })
            .catch(error => {
              console.error("Error getting feature info:", error);
              setBottomCanvasData({
                ...loadingData,
                featureInfo: "Error loading data"
              });
            });


          wmsHandled = true;
          break; // Only handle with the first WMS layer
        }
      }
      
      // If no WMS layer handled the click, do the general map click (fallback like widget1)
      if (!wmsHandled) {
        console.log("No WMS layer handled click, doing general map click");
        
        // Convert latlng to WMS parameters for GetFeatureInfo
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
          timeDimension: currentSliderDate?.toISOString() || "",
          featureInfo: "No active WMS layer"
        };
        
         setBottomCanvasData(wmsData);
         setShowBottomCanvas(true); // Show the bottom canvas when data is set
         console.log("Bottom canvas data set:", wmsData);
         console.log("🚀 Calling setShowBottomCanvas(true) - fallback");
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    }
  }, [mapInstance, currentSliderDate, setBottomCanvasData, setShowBottomCanvas]); // Removed setters as they are stable

  return (
    <div className="forecast-app">
      <div className="main-container">
        <div className="map-section">
          <div ref={mapRef} id="map" className="forecast-map"></div>
          <div className={`legend-overlay ${legendVisible ? 'legend-overlay--visible' : 'legend-overlay--hidden'}`}>
            <button
              type="button"
              className="legend-overlay__toggle"
              onClick={() => setLegendVisible(prev => !prev)}
              title={legendVisible ? 'Hide legend' : 'Show legend'}
            >
              {legendVisible ? 'Hide Legend' : 'Show Legend'}
            </button>
            {legendVisible && (
              <WorldClassLegend 
                selectedLayer={selectedLayer}
                opacity={opacity}
                showDescription={true}
                compactMode={false}
              />
            )}
          </div>
        </div>

        <div className="controls-panel">
          <div className="forecast-controls">
        <div className="control-group">
          <h3>📊 Forecast Variables</h3>
          <div className="variable-buttons">
            {WAVE_FORECAST_LAYERS.filter(layer => !layer.composite).map((layer) => {
              // Shorten labels to fit better in buttons
              const getShortLabel = (label) => {
                const labelMap = {
                  'Significant Wave Height': 'Wave Height',
                  'Wave Direction (arrow)': 'Wave Direction',
                  'Mean Wave Period': 'Wave Period', 
                  'Peak Wave Period': 'Peak Period',
                  'Mean Wave Direction': 'Mean Dir',
                  'Wind U Component': 'Wind U',
                  'Wind V Component': 'Wind V',
                  'Wave Direction': 'Wave Dir',
                  'Inundation Depth': 'Inundation'
                };
                return labelMap[label] || label;
              };
              
              return (
                <button
                  type="button"
                  key={layer.value}
                  className={`var-btn ${selectedWaveForecast === layer.value ? 'active' : ''}`}
                  onClick={() => handleVariableChange(layer.value)}
                >
                  {getShortLabel(layer.label)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="control-group">
          <h3>⏰ Forecast Time</h3>
          <div className="time-control">
            <div className="forecast-info">
              <div>Current Time: <span>+{sliderIndex} hours</span></div>
              <div>Valid: <span>{formatTime(currentSliderDate)}</span></div>
            </div>
            
            <div className="time-slider-container">
              <input
                title="Forecast Time"
               aria-label="Forecast Time"
                type="range"
                className="time-slider"
                min="0"
                max={totalSteps}
                value={sliderIndex}
                onChange={(e) => handleSliderChange(e.target.value)}
                disabled={capTime.loading}
              />
              
              <div className="playback-controls">
                <button 
                  type="button"
                  className="play-btn"
                  onClick={handlePlayToggle}
                  disabled={capTime.loading}
                >
                  <span>{isPlaying ? '⏸️ Pause' : '▶️ Play'}</span>
                </button>
              </div>
            </div>
            
            <div className="forecast-info">
              <div>Forecast Length: <strong>{totalSteps + 1} hours</strong></div>
            </div>
          </div>
        </div>

        <div className="control-group">
          <h3>📈 Current Values</h3>
          <div className="forecast-info">
            <div>Variable: <span>{displayInfo.name}</span></div>
            <div className="forecast-value">{currentValue}</div>
            <div className="forecast-units">{displayInfo.units}</div>
            {isUpdatingVisualization && (
              <div className="dynamic-update-indicator">
                <span className="update-spinner">🔄</span>
                <span>AI-optimizing visualization...</span>
              </div>
            )}
          </div>
        </div>

        <div className="control-group">
          <h3>🎨 Display Options</h3>
         <div className="opacity-control">
            <label>
              Overlay Opacity: <span>{Math.round(opacity * 100)}%</span>
            </label>

            <input
              aria-label="overlay-opacity" 
              title="overlay-opacity"
              type="range"
              className="opacity-slider"
              min="0"
              max="100"
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(e.target.value / 100)}
            />
          </div>
        </div>

        {/* 🌊 WORLD-CLASS LEGEND */}
        <div className="control-group">
          <h3>ℹ️ Data Info</h3>
          <div className="data-info">
            <div><strong>Source:</strong> Pacific Community (SPC)</div>
            <div><strong>Model:</strong> SCHISM + WaveWatch III</div>
            <div><strong>Resolution:</strong> Unstructured Mesh</div>
            <div><strong>Update:</strong> 4x Daily</div>
            <div><strong>Coverage:</strong> Cook Islands</div>
          </div>
        </div>
          </div>
        </div>

        <div className="status-bar">
          <div>© 2025 Cook Islands Marine Forecast</div>
        </div>
      </div>
    </div>
  );
};

export default ForecastApp;
