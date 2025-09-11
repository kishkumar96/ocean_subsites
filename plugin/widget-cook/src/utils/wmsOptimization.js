// WMS Performance Optimization Utilities

/**
 * Global configuration for WMS performance optimization
 */
export const WMS_OPTIMIZATION_CONFIG = {
  // Reduce concurrent tile requests to prevent overwhelming the server
  maxConcurrentRequests: 4,
  
  // Tile loading optimization
  tileSize: 256,
  maxZoom: 16,
  minZoom: 4,
  
  // Timeout configurations
  tileTimeout: 15000,
  capabilitiesTimeout: 10000,
  
  // Retry configuration
  maxRetries: 3,
  retryDelayBase: 1000, // Base delay for exponential backoff
  
  // Cache settings
  tileCacheTimeout: 5 * 60 * 1000, // 5 minutes for tiles
  capabilitiesCacheTimeout: 30 * 60 * 1000, // 30 minutes for capabilities
  
  // Performance settings
  keepBuffer: 1, // Reduced from default 2
  updateWhenIdle: true,
  updateWhenZooming: false,
  updateInterval: 300,
};

/**
 * Request queue to manage concurrent WMS requests
 */
class WMSRequestQueue {
  constructor(maxConcurrent = WMS_OPTIMIZATION_CONFIG.maxConcurrentRequests) {
    this.maxConcurrent = maxConcurrent;
    this.activeRequests = 0;
    this.queue = [];
  }

  async add(requestFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFunction, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { requestFunction, resolve, reject } = this.queue.shift();
    this.activeRequests++;

    try {
      const result = await requestFunction();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeRequests--;
      // Process next item in queue
      setTimeout(() => this.processQueue(), 100);
    }
  }
}

// Global request queue instance
export const wmsRequestQueue = new WMSRequestQueue();

/**
 * Optimized Leaflet WMS options
 */
export function getOptimizedWMSOptions(customOptions = {}) {
  return {
    format: 'image/png',
    transparent: true,
    version: '1.1.1', // Use 1.1.1 instead of 1.3.0 for better compatibility
    
    // Performance optimizations
    maxZoom: WMS_OPTIMIZATION_CONFIG.maxZoom,
    minZoom: WMS_OPTIMIZATION_CONFIG.minZoom,
    tileSize: WMS_OPTIMIZATION_CONFIG.tileSize,
    
    // Reduce tile buffer to decrease memory usage
    keepBuffer: WMS_OPTIMIZATION_CONFIG.keepBuffer,
    
    // Update behavior
    updateWhenIdle: WMS_OPTIMIZATION_CONFIG.updateWhenIdle,
    updateWhenZooming: WMS_OPTIMIZATION_CONFIG.updateWhenZooming,
    updateInterval: WMS_OPTIMIZATION_CONFIG.updateInterval,
    
    // Error handling
    errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    
    // CORS and caching
    crossOrigin: 'anonymous',
    
    // Merge with custom options
    ...customOptions
  };
}

/**
 * Debounced function to prevent excessive map updates
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttled function for high-frequency events
 */
export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if the WMS server is responsive
 */
export async function checkWMSServerHealth(baseUrl, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const capabilitiesUrl = `${baseUrl}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1`;
    const response = await fetch(capabilitiesUrl, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('WMS server health check failed:', error.message);
    return false;
  }
}

/**
 * Optimized tile URL generation with cache control
 */
export function generateOptimizedTileUrl(baseUrl, params, useCache = true) {
  const urlParams = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    SRS: 'EPSG:3857',
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    ...params
  });
  
  // Add cache control
  if (!useCache) {
    urlParams.set('_t', Date.now().toString());
  }
  
  return `${baseUrl}?${urlParams.toString()}`;
}