import L from 'leaflet';
import { getProxyWmsUrl, corsAwareFetch } from '../utils/wmsProxy';
import { getOptimizedWMSOptions, wmsRequestQueue, checkWMSServerHealth } from '../utils/wmsOptimization';

/**
 * Adds a WMS tile layer to a Leaflet map for Cook Islands.
 *
 * @param {L.Map} map - The Leaflet map instance to which the WMS layer will be added.
 * @param {string} url - The URL of the WMS service.
 * @param {Object} [options] - Optional parameters for the WMS layer.
 * @param {function} handleShow - Callback function to handle the feature info data (canvas update).
 */
const addCookWMSTileLayer = (map, url, options = {}, handleShow) => {
    // Use proxy-aware URL consistently
    const wmsUrl = getProxyWmsUrl(url);

    // Create the WMS tile layer with optimized performance settings
    const wmsLayer = L.tileLayer.wms(wmsUrl, {
        ...options,
        format: 'image/png',
        transparent: true,
        attribution: `Layer: ${options.layers || 'unknown'}`,
        // Performance optimizations
        maxZoom: 18,
        minZoom: 3,
        tileSize: 256,
        zoomOffset: 0,
        crossOrigin: 'anonymous',
        // Increase tile loading timeout and retries
        timeout: 15000,
        retryDelay: 2000,
        retryLimit: 3,
        // Leaflet performance options
        keepBuffer: 2,
        updateWhenIdle: false,
        updateWhenZooming: false,
        updateInterval: 200
    });

    // Add the layer to the map
    wmsLayer.addTo(map);

    // Optimized retry logic with exponential backoff
    const retryFailedTile = (tile, src, attempt = 1) => {
        const maxRetries = 3;
        if (attempt > maxRetries) {
            console.warn(`Tile failed permanently after ${maxRetries} attempts:`, src);
            // Set a placeholder or error tile
            tile.style.opacity = '0.3';
            tile.style.filter = 'grayscale(100%)';
            return;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        
        setTimeout(() => {
            // Add cache-busting parameter and timestamp
            const separator = src.includes('?') ? '&' : '?';
            const retryUrl = `${src}${separator}_retry=${attempt}&_t=${Date.now()}`;
            
            tile.onload = () => {
                console.log(`Tile retry ${attempt} succeeded:`, src);
                tile.style.opacity = '';
                tile.style.filter = '';
            };
            tile.onerror = () => retryFailedTile(tile, src, attempt + 1);
            
            tile.src = retryUrl;
        }, delay);
    };

    // Enhanced tile error handling
    wmsLayer.on('tileerror', (e) => {
        const tile = e.tile;
        const originalSrc = tile.src;
        
        // Check if this is a timeout error vs server error
        setTimeout(() => {
            // Quick HEAD request to check server availability
            corsAwareFetch(originalSrc, { method: 'HEAD' })
                .then(response => {
                    if (response && response.ok) {
                        console.log('Server available, retrying tile load');
                        retryFailedTile(tile, originalSrc, 1);
                    } else {
                        console.warn('Server error, skipping retry for tile:', originalSrc);
                    }
                })
                .catch(error => {
                    // Network error, try retry anyway
                    console.log('Network error, attempting retry:', error.message);
                    retryFailedTile(tile, originalSrc, 1);
                });
        }, 100);
    });

    // Consolidated GetFeatureInfo function - ONLY ONE REQUEST PER CLICK
    const performGetFeatureInfo = (latlng) => {
        const mapSize = map.getSize();
        const point = map.latLngToContainerPoint(latlng);
        const bbox = map.getBounds();
        
        // Build the GetFeatureInfo URL using the same proxy logic as WMS tiles
        const baseUrl = getProxyWmsUrl(url);
        const featureInfoUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + new URLSearchParams({
            SERVICE: 'WMS',
            VERSION: '1.3.0',
            REQUEST: 'GetFeatureInfo',
            LAYERS: options.layers,
            QUERY_LAYERS: options.layers,
            CRS: 'CRS:84',
            BBOX: [
                bbox.getWest(),
                bbox.getSouth(),
                bbox.getEast(),
                bbox.getNorth()
            ].join(','),
            WIDTH: mapSize.x,
            HEIGHT: mapSize.y,
            I: Math.round(point.x),
            J: Math.round(point.y),
            INFO_FORMAT: 'text/xml',
            TIME: options.time || '',
            FORMAT: 'image/png',
            TRANSPARENT: 'true'
        }).toString();

        return fetch(featureInfoUrl)  // Use fetch on proxy URL
            .then(response => {
                if (!response.ok) {
                    throw new Error(`GetFeatureInfo failed: ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                console.log(`FeatureInfo for ${options.layers}:`, data);
                if (handleShow) {
                    handleShow(data, latlng);
                }
                return data;
            })
            .catch(error => {
                console.warn(`FeatureInfo error for ${options.layers}:`, error.message);
                throw error;
            });
    };

    // Attach getFeatureInfo method to the layer
    wmsLayer.getFeatureInfo = performGetFeatureInfo;

    return wmsLayer;
};

export default addCookWMSTileLayer;
