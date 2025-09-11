// WMS URL utilities for handling CORS and proxy configurations

/**
 * Converts a THREDDS WMS URL to use local proxy during development
 * @param {string} originalUrl - The original THREDDS WMS URL
 * @returns {string} - Proxy URL for development or original URL for production
 */
export function getProxyWmsUrl(originalUrl) {
  // In development, use the proxy to avoid CORS issues
  if (process.env.NODE_ENV === 'development') {
    // Replace the base THREDDS URL with our proxy path
    if (originalUrl.includes('gemthreddshpc.spc.int')) {
      return originalUrl.replace('https://gemthreddshpc.spc.int', '/spc-wms');
    }
  }
  
  // In production, use the original URL
  return originalUrl;
}

/**
 * Creates WMS layer configuration with proxy support
 * @param {Object} layerConfig - Original layer configuration
 * @returns {Object} - Updated layer configuration with proxy URLs
 */
export function createProxyLayerConfig(layerConfig) {
  const updatedConfig = { ...layerConfig };
  
  if (updatedConfig.wmsUrl) {
    updatedConfig.wmsUrl = getProxyWmsUrl(updatedConfig.wmsUrl);
  }
  
  // Handle composite layers
  if (updatedConfig.layers) {
    updatedConfig.layers = updatedConfig.layers.map(layer => ({
      ...layer,
      wmsUrl: layer.wmsUrl ? getProxyWmsUrl(layer.wmsUrl) : layer.wmsUrl
    }));
  }
  
  return updatedConfig;
}

/**
 * Base URL for WMS requests
 */
export const WMS_BASE_URL = process.env.NODE_ENV === 'development' 
  ? '/thredds-proxy/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc'
  : 'https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc';

/**
 * Handles fetch requests with CORS fallback
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise} - Fetch promise with error handling
 */
export async function corsAwareFetch(url, options = {}) {
  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);
  
  try {
    // Use proxy URL in development
    const proxyUrl = getProxyWmsUrl(url);
    
    const fetchOptions = {
      ...options,
      mode: 'cors',
      signal: controller.signal,
      headers: {
        'Accept': 'image/png,image/jpeg,image/*;q=0.9,application/xml,text/xml,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': options.method === 'HEAD' ? 'no-cache' : 'public, max-age=300',
        'User-Agent': 'WMS-Client/1.0',
        ...options.headers
      }
    };
    
    const response = await fetch(proxyUrl, fetchOptions);
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.warn(`Request timeout after ${options.timeout || 15000}ms:`, url);
      throw new Error('REQUEST_TIMEOUT');
    }
    
    console.warn('CORS fetch failed:', error.message, 'URL:', url);
    
    // If we're in development and the proxy fails, provide more context
    if (process.env.NODE_ENV === 'development') {
      if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        throw new Error('PROXY_TIMEOUT');
      }
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error('PROXY_CONNECTION_REFUSED');
      }
      console.warn('Falling back due to proxy failure');
      throw new Error('CORS_BLOCKED');
    }
    
    throw error;
  }
}
