import { useState, useEffect } from 'react';

/**
 * Hook for fetching and managing WMS capabilities
 * Handles time dimension parsing and capability metadata
 */
export const useWMSCapabilities = (selectedLayer, allLayers) => {
  const [capTime, setCapTime] = useState({ 
    loading: true, 
    start: new Date(), 
    end: new Date(), 
    stepHours: 1 
  });

  useEffect(() => {
    async function fetchCapabilities() {
      setCapTime((prev) => ({ ...prev, loading: true }));
      try {
        // First try to find layer directly
        let selectedLayerConfig = allLayers.find(l => l.value === selectedLayer);
        
        // If not found, check if it's a sub-layer of a composite layer
        if (!selectedLayerConfig) {
          for (const layer of allLayers) {
            if (layer?.composite && layer?.layers) {
              const subLayer = layer.layers.find(sub => sub?.value === selectedLayer);
              if (subLayer) {
                console.log(`🔍 Found sub-layer in composite: ${selectedLayer} in ${layer.value}`);
                selectedLayerConfig = layer; // Use parent composite for general config
                break;
              }
            }
          }
        }
        
        console.log(`🔍 Fetching capabilities for layer: ${selectedLayer}`);
        console.log(`🔍 Layer config:`, selectedLayerConfig);
        
        // Skip capabilities fetch for static layers
        if (selectedLayerConfig?.isStatic) {
          console.log(`⏭️ Skipping capabilities for static layer: ${selectedLayer}`);
          setCapTime({
            loading: false,
            start: new Date(),
            end: new Date(),
            stepHours: 1,
            totalSteps: 0,
            availableTimestamps: []
          });
          return;
        }
        
        // Determine which layer to use for capabilities
        let capsLayer = selectedLayerConfig;
        if (selectedLayerConfig?.composite) {
          // For composite layers, find the appropriate sub-layer for capabilities
          // If we're looking for a specific sub-layer (like cook_forecast/hs), use that
          const requestedSubLayer = selectedLayerConfig.layers?.find(sub => sub?.value === selectedLayer);
          if (requestedSubLayer) {
            capsLayer = requestedSubLayer;
            console.log(`🔄 Using requested sub-layer for capabilities:`, capsLayer);
          } else {
            // Otherwise, prefer wave height layer for capabilities (not direction)
            const waveHeightLayer = selectedLayerConfig.layers?.find(layer => 
              layer.value && (layer.value.includes('hs') || layer.value.includes('height'))
            );
            capsLayer = waveHeightLayer || selectedLayerConfig.layers?.[0];
            console.log(`🔄 Using preferred sub-layer for capabilities:`, capsLayer);
          }
        }
        if (!capsLayer?.wmsUrl) {
          console.error("Layer configuration missing wmsUrl:", {
            selectedLayer: selectedLayer,
            selectedLayerConfig: selectedLayerConfig,
            capsLayer: capsLayer
          });
          throw new Error(`WMS URL not defined for layer: ${selectedLayer}`);
        }
        
        let urlForCaps = capsLayer.wmsUrl;
        const isThreddsServer = urlForCaps.includes('thredds');
        
        if (!urlForCaps.toLowerCase().includes("request=getcapabilities")) {
          urlForCaps += (urlForCaps.includes("?") ? "&" : "?") + "SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0";
        }
        
        // THREDDS servers may need different handling
        if (isThreddsServer) {
          console.log(`🌐 Using THREDDS server for capabilities: ${urlForCaps}`);
        }
        
        console.log(`🌐 Fetching capabilities from: ${urlForCaps}`);
        
        const res = await fetch(urlForCaps);
        if (!res.ok) {
          throw new Error(`Failed to fetch capabilities: ${res.status} ${res.statusText}`);
        }
        
        const xml = await res.text();
        console.log(`📄 Capabilities XML length: ${xml.length} characters`);
        
        const timeDim = parseTimeDimensionFromCapabilities(xml, capsLayer.value);
        if (!timeDim) {
          console.warn(`⚠️ No time dimension found for layer: ${capsLayer.value}`);
          
          // Special handling for THREDDS wave direction layers
          if (isThreddsServer && capsLayer.value === 'dirm') {
            console.log(`ℹ️ Wave direction layer from THREDDS - using time from wave height layer`);
            // Wave direction uses same time as wave height, so we'll handle this in composite layer logic
          }
          
          // For layers without time dimension, treat as static
          setCapTime({
            loading: false,
            start: new Date(),
            end: new Date(),
            stepHours: 1,
            totalSteps: 0,
            availableTimestamps: []
          });
          return;
        }
        
        console.log(`🕒 Time dimension for ${capsLayer.value}:`, timeDim.raw);
        
        const timeInfo = getTimeRangeFromDimension(timeDim.raw) || {};
        
        if (timeInfo.availableTimestamps) {
          console.log(`📅 Found ${timeInfo.availableTimestamps.length} available timestamps for ${capsLayer.value}`);
          console.log(`📅 First timestamp: ${timeInfo.availableTimestamps[0]?.toISOString()}`);
          console.log(`📅 Last timestamp: ${timeInfo.availableTimestamps[timeInfo.availableTimestamps.length - 1]?.toISOString()}`);
        }
        const timeRange = getTimeRangeFromDimension(timeDim.raw);
        if (!timeRange) throw new Error("Could not parse time dimension.");
        
        const { start, end, stepHours, availableTimestamps } = timeRange;
        const newTotalSteps = availableTimestamps ? availableTimestamps.length - 1 : 0;
        
        setCapTime({
          loading: false,
          start: start || new Date(),
          end: end || new Date(),
          stepHours: stepHours || 6,
          totalSteps: newTotalSteps,
          availableTimestamps: availableTimestamps || []
        });
      } catch (error) {
        console.error("Error fetching capabilities:", error.message);
        setCapTime((prev) => ({ ...prev, loading: false }));
      }
    }

    if (selectedLayer) {
      fetchCapabilities();
    }
  }, [selectedLayer, allLayers]);

  return capTime;
};

// Helper functions (move these from the main file)
const WMS_NAMESPACE = 'http://www.opengis.net/wms';

const parseTimeDimensionFromCapabilities = (xml, layerName) => {
  try {
    // Use requestIdleCallback for better performance if available
    const parseWork = () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, "text/xml");

      const resolveNamespace = (prefix) => {
        if (prefix === 'wms') return WMS_NAMESPACE;
        return xmlDoc.lookupNamespaceURI(prefix) || null;
      };

      let targetLayer = null;

      // Attempt namespace-aware XPath lookup first
      if (xmlDoc.evaluate) {
        const xpath = `//wms:Layer[wms:Name[text()='${layerName}']]`;
        const result = xmlDoc.evaluate(
          xpath,
          xmlDoc,
          resolveNamespace,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        targetLayer = result?.singleNodeValue || null;
      }

      // Fallback to manual traversal when XPath misses (common with default namespaces)
      if (!targetLayer) {
        const layers = Array.from(
          xmlDoc.getElementsByTagNameNS(WMS_NAMESPACE, 'Layer')
        );

        if (!layers.length) {
          // As a last resort, allow namespace-agnostic search
          layers.push(...Array.from(xmlDoc.getElementsByTagName('Layer')));
        }

        targetLayer = layers.find(layer => {
          const nameNode = layer.getElementsByTagNameNS(WMS_NAMESPACE, 'Name')[0]
            || layer.getElementsByTagName('Name')[0];
          const candidateName = nameNode?.textContent?.trim();
          return candidateName === layerName;
        }) || null;

        if (targetLayer) {
          console.info(`✅ Found target layer via fallback search: ${layerName}`);
        }
      }

      if (!targetLayer) {
        console.info(`❌ Layer ${layerName} not found in capabilities`);
        return null;
      }

      const dimensionCandidates = [
        ...Array.from(targetLayer.getElementsByTagNameNS(WMS_NAMESPACE, 'Dimension')),
        ...Array.from(targetLayer.getElementsByTagNameNS(WMS_NAMESPACE, 'Extent')),
        ...Array.from(targetLayer.getElementsByTagName('Dimension')),
        ...Array.from(targetLayer.getElementsByTagName('Extent')),
      ];

      const timeDim = dimensionCandidates.find((dim) => {
        const nameAttr = dim.getAttribute('name') || dim.getAttribute('Name');
        return nameAttr?.toLowerCase() === 'time';
      });

      if (timeDim) {
        const rawTimeData = timeDim.textContent?.trim() || '';
        console.log(`🕒 Found time dimension: ${rawTimeData}`);
        return {
          raw: rawTimeData,
          units: timeDim.getAttribute('units') || 'ISO8601'
        };
      }

      console.warn(`⚠️ No time dimension found in layer: ${layerName}`);
      return null;
    };

    return parseWork();
  } catch (error) {
    console.error("Error parsing capabilities XML:", error);
    return null;
  }
};

const getTimeRangeFromDimension = (timeDimString) => {
  if (!timeDimString) return null;
  
  try {
    // Handle comma-separated individual timestamps
    if (timeDimString.includes(',')) {
      const timestamps = timeDimString.split(',').map(t => t.trim()).filter(Boolean);
      const validTimestamps = timestamps
        .map(t => new Date(t))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      
      if (validTimestamps.length > 0) {
        return {
          start: validTimestamps[0],
          end: validTimestamps[validTimestamps.length - 1],
          step: 'PT1H', // Default step
          availableTimestamps: validTimestamps
        };
      }
    }
    
    // Handle range format (start/end/step)
    if (timeDimString.includes('/')) {
      const parts = timeDimString.split('/');
      if (parts.length >= 2) {
        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        const step = parts[2] || 'PT6H'; // Default to 6 hours for marine forecast
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          // Generate available timestamps for range format every 6 hours
          const stepHours = getStepHours(step);
          const availableTimestamps = [];
          let current = new Date(start);
          
          console.log(`🌊 Generating 6-hour timestamps from ${start.toISOString()} to ${end.toISOString()}, step: ${stepHours}h`);
          
          while (current <= end) {
            availableTimestamps.push(new Date(current));
            current = new Date(current.getTime() + stepHours * 60 * 60 * 1000);
          }
          
          console.log(`🌊 Generated ${availableTimestamps.length} available timestamps (6-hour intervals)`);
          
          return { start, end, step, stepHours, availableTimestamps };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing time range:", error);
    return null;
  }
};

const getStepHours = (stepString) => {
  if (!stepString) return 6; // Default to 6 hours since data is available every 6 hours
  
  try {
    // Parse ISO 8601 duration (e.g., PT1H, PT3H, PT6H)
    if (stepString.startsWith('PT') && stepString.endsWith('H')) {
      const hours = parseInt(stepString.slice(2, -1));
      return isNaN(hours) ? 6 : hours;
    }
    
    // Handle other formats
    if (stepString.includes('hour')) {
      const match = stepString.match(/(\d+)\s*hour/i);
      if (match) {
        return parseInt(match[1]) || 6;
      }
    }
    
    return 6; // Default to 6 hours for marine forecast data
  } catch (error) {
    console.error("Error parsing step hours:", error);
    return 6;
  }
};
