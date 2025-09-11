import L from 'leaflet';

/**
 * Create WMS GetCapabilities URL
 * @param {string} baseUrl - Base WMS URL
 * @returns {string} GetCapabilities URL
 */
export function createWMSCapabilitiesUrl(baseUrl) {
  const params = {
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetCapabilities'
  };
  
  return baseUrl + L.Util.getParamString(params, baseUrl, true);
}

/**
 * Create WMS GetFeatureInfo URL
 * @param {string} baseUrl - Base WMS URL  
 * @param {Object} params - GetFeatureInfo parameters
 * @returns {string} GetFeatureInfo URL
 */
export function createWMSFeatureInfoUrl(baseUrl, params) {
  const defaultParams = {
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    INFO_FORMAT: 'text/html',
    TRANSPARENT: true
  };
  
  const allParams = { ...defaultParams, ...params };
  
  let featureInfoUrl = baseUrl + L.Util.getParamString(allParams, baseUrl, true);
  
  // Clean up URL formatting issues common with THREDDS WMS
  featureInfoUrl = featureInfoUrl.replace(/wms\?.*?REQUEST=[^&]*?&.*?REQUEST=[^&]*?&/, '');
  featureInfoUrl = featureInfoUrl.replace(/VERSION=1\.3\.0&/g, '');
  featureInfoUrl = featureInfoUrl.replace(/\/ncWMS\/?(?!wms\?)/i, '/ncWMS/wms?REQUEST=GetFeatureInfo&');
  
  return featureInfoUrl;
}

/**
 * Parse time dimension from WMS capabilities XML
 * @param {string} xml - GetCapabilities XML response
 * @param {string} layerName - Layer name to find time dimension for
 * @returns {Object|null} Time dimension info or null if not found
 */
export function parseTimeDimensionFromCapabilities(xml, layerName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const layers = doc.getElementsByTagName("Layer");
  
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const nameEl = layer.getElementsByTagName("Name")[0];
    if (nameEl && nameEl.textContent === layerName) {
      const dimensions = layer.getElementsByTagName("Dimension");
      for (let j = 0; j < dimensions.length; j++) {
        const dimension = dimensions[j];
        if (dimension.getAttribute("name") === "time") {
          const timeValue = dimension.textContent.trim();
          const parts = timeValue.split("/");
          if (parts.length === 3) {
            return {
              start: new Date(parts[0]),
              end: new Date(parts[1]),
              period: parts[2]
            };
          }
        }
      }
    }
  }
  return null;
}