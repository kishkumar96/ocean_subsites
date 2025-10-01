import { useEffect, useRef } from 'react';
import L from 'leaflet';

/**
 * Hook for managing Leaflet map rendering and WMS layer visualization
 * Handles map instance, layer addition/removal, and rendering logic
 */
export const useMapRendering = ({
  activeLayers,
  selectedWaveForecast,
  dynamicLayers,
  staticLayers,
  currentSliderDateStr,
  wmsOpacity,
  addWMSTileLayer,
  handleShow,
  bounds
}) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const wmsLayerGroup = useRef(null);
  const wmsLayerRefs = useRef([]);
  const layerRefs = useRef({});

  // Initialize map with base layers
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      const map = L.map(mapRef.current);
      if (bounds) {
        map.fitBounds(bounds);
      }
      mapInstance.current = map;

      // Add base layers
      const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
        attribution: '&copy; OpenStreetMap' 
      });
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { 
        attribution: '© Esri' 
      });
      
      // Set satellite as the default layer
      satelliteLayer.addTo(map);
      layerRefs.current.satellite = satelliteLayer;
      
      // Create WMS layer group
      wmsLayerGroup.current = L.layerGroup().addTo(map);

      // Add layer controls
      const baseMaps = { "OpenStreetMap": osmLayer, "Satellite": satelliteLayer };
      const overlayMaps = { "Wave Forecast": wmsLayerGroup.current };
      L.control.layers(baseMaps, overlayMaps).addTo(map);

      // Add controls
      if (map.zoomControl) {
        map.zoomControl.setPosition('topleft');
      }
      L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);
    }
    
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [bounds]);

  // WMS layer rendering effect
  useEffect(() => {
    if (!mapInstance.current || !wmsLayerGroup.current) return;
    if (!activeLayers.waveForecast) return;

    // Clear existing WMS layers
    wmsLayerGroup.current.clearLayers();
    wmsLayerRefs.current.forEach(layer => {
      if (layer && mapInstance.current.hasLayer(layer)) {
        mapInstance.current.removeLayer(layer);
      }
    });
    wmsLayerRefs.current = [];

    // Find selected layer - check dynamic layers first, then static layers
    let selectedLayer = dynamicLayers.find(l => l.value === selectedWaveForecast);
    if (!selectedLayer) {
      selectedLayer = staticLayers.find(l => l.value === selectedWaveForecast);
    }
    if (!selectedLayer) return;

    // Determine if layer is time-dimensionless
    const isTimeDimensionless = selectedLayer.isStatic || selectedLayer.id === 200;
    
    // Prepare layers to add
    const layersToAdd = selectedLayer.composite ? selectedLayer.layers : [selectedLayer];

    layersToAdd.forEach(layerConfig => {
      const commonOptions = {
        layers: layerConfig.value,
        format: "image/png",
        transparent: true,
        opacity: wmsOpacity,
        styles: layerConfig.style,
        version: '1.3.0',
        DATASET: layerConfig.dataset || 'cook_forecast',
        crs: L.CRS.EPSG4326,
        pane: 'overlayPane',
      };

      // Only add time parameter for time-dimensional layers
      if (!isTimeDimensionless && currentSliderDateStr) {
        commonOptions.time = currentSliderDateStr;
      }

      // Add WMS layer to map
      const wmsLayer = addWMSTileLayer(
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

  }, [
    activeLayers.waveForecast, 
    selectedWaveForecast, 
    handleShow, 
    currentSliderDateStr, 
    wmsOpacity, 
    dynamicLayers,
    staticLayers,
    addWMSTileLayer
  ]);

  return {
    mapRef,
    mapInstance,
    wmsLayerGroup: wmsLayerGroup.current,
    wmsLayerRefs: wmsLayerRefs.current
  };
};