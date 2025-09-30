import L from 'leaflet';
import $ from 'jquery';

/**
 * Adds a    const handleTileError = (event) => {
        const tile = event.tile;
        consecutiveErrors++;
        
        // Store original WMS URL before Leaflet replaces it with a data URL
        // Get the URL from the tile element's dataset or reconstruct from WMS layer
        if (!tile._originalWMSUrl) {
            if (tile.src && !tile.src.startsWith('data:')) {
                tile._originalWMSUrl = tile.src;
            } else {
                // Reconstruct the base WMS URL from the layer parameters
                const baseUrl = url + '?' + new URLSearchParams(finalOptions).toString();
                tile._originalWMSUrl = baseUrl;
            }
        }e layer to a Leaflet map.
 *
 * @param {L.Map} map - The Leaflet map instance to which the WMS layer will be added.
 * @param {string} url - The URL of the WMS service.
 * @param {Object} [options] - Optional parameters for the WMS layer.
 * @param {function} handleShow - Callback function to handle the feature info data (canvas update).
 */
const addWMSTileLayer = (map, url, options = {}, handleShow) => {
    // Separate the non-standard 'id' from the WMS options
    const { id, ...wmsOptions } = options;

    // Set default options
    const defaultOptions = {
        layers: '',
        format: 'image/png',
        transparent: true,
        ...wmsOptions.params,
    };

    // WMS 1.3.0 requires lat/lng axis order for EPSG:4326, which Leaflet might not do by default.
    // We explicitly set the CRS on the layer to enforce this.
    if (wmsOptions.version === '1.3.0' && wmsOptions.crs === L.CRS.EPSG4326) {
        wmsOptions.crs = L.CRS.EPSG4326;
    }

    // Merge defaults with provided options so we can safely override styles
    const finalOptions = {
        ...defaultOptions,
        ...wmsOptions,
        layers: wmsOptions.layers || defaultOptions.layers,
        format: wmsOptions.format || defaultOptions.format,
        transparent: wmsOptions.transparent !== undefined ? wmsOptions.transparent : defaultOptions.transparent,
    };

    // Ensure peak period layer always uses the server-compatible magma palette and proper range
    const targetLayerName = finalOptions.layers || '';
    if (targetLayerName.includes('tpeak')) {
        const currentStyle = finalOptions.styles || '';
        if (!currentStyle) {
            finalOptions.styles = 'default-scalar/psu-magma';
        } else if (currentStyle.includes('psu-plasma') || currentStyle.includes('seq-')) {
            finalOptions.styles = 'default-scalar/psu-magma';
        }
        
        // Ensure proper color scale range for Cook Islands tpeak data
        if (!finalOptions.colorscalerange) {
            finalOptions.colorscalerange = '9.985,13.68';
            console.log('🌊 Setting Cook Islands tpeak color scale range: 9.985-13.68s');
        }
    }

    // Handle raro_inun (Rarotonga inundation) layer configuration
    if (targetLayerName.includes('raro_inun')) {
        // Ensure proper color scale range for inundation data
        if (!finalOptions.colorscalerange) {
            finalOptions.colorscalerange = '-0.05,1.63';
            console.log('🌧️ Setting Rarotonga inundation color scale range: -0.05-1.63m');
        }
        // Ensure proper style for inundation visualization
        if (!finalOptions.styles) {
            finalOptions.styles = 'default-scalar/seq-Blues';
        }
    }

    // Clean up undefined values to prevent them from appearing in WMS requests
    Object.keys(finalOptions).forEach(key => {
        if (finalOptions[key] === undefined) {
            delete finalOptions[key];
        }
    });

    // For ncWMS servers, we need to create a custom WMS layer that handles the coordinate transformation
    let wmsLayer;
    // For non-ncWMS servers, use the standard WMS layer
    wmsLayer = L.tileLayer.wms(url, finalOptions);
    
    // Add the layer to the map
    wmsLayer.addTo(map);

    // Enhanced error handling for HTTP/2 protocol errors
    const RETRY_LIMIT = 6; // Increased retry limit for server issues
    const RETRY_DELAY = 1500; // Reduced delay for faster recovery
    let consecutiveErrors = 0;
    let serverErrorNotified = false;

    const handleTileError = (e) => {
        const tile = e.tile;
        consecutiveErrors++;
        
        // Store original WMS URL before Leaflet replaces it with data URL
        if (!tile._originalWMSUrl && tile.src && !tile.src.startsWith('data:')) {
            tile._originalWMSUrl = tile.src;
        }
        
        // Enhanced error detection for tpeak and inundation layer issues
        const isTpeakLayer = targetLayerName.includes('tpeak');
        const isInundationLayer = targetLayerName.includes('raro_inun');
        const isLimitedDataLayer = isTpeakLayer;

        if (isLimitedDataLayer && consecutiveErrors <= 2) {
            console.warn('🌊 Peak wave period data may not be available for current time - this is normal for limited temporal coverage');
            // For limited data layers, don't show as many error messages since limited temporal data is expected
        } else if (isInundationLayer && consecutiveErrors <= 2) {
            console.warn('🌧️ Rarotonga inundation layer error - checking configuration');
        } else if (consecutiveErrors <= 3) {
            console.warn('🌊 Marine forecast: Tile load failed, implementing recovery strategy');
        } else if (consecutiveErrors === 10 && !serverErrorNotified) {
            const layerType = isTpeakLayer ? 'Peak wave period' : 
                             isInundationLayer ? 'Rarotonga inundation' : 
                             'Marine forecast';
            console.warn(`🌊 Cook Islands ${layerType}: Experiencing server connectivity issues. Attempting recovery...`);
            serverErrorNotified = true;
            
            // Try to show user-friendly message
            if (typeof window !== 'undefined' && window.showNotification) {
                const message = isLimitedDataLayer 
                    ? `${layerType} data may have limited availability for current time period`
                    : 'Marine data server experiencing connectivity issues. Retrying automatically...';
                window.showNotification(message, 'warning');
            }
        }
        
        // Progressive retry with exponential backoff for server issues
        const retryDelay = RETRY_DELAY * Math.min(consecutiveErrors / 2, 4);
        setTimeout(() => {
            // Use stored original URL instead of current tile.src (which might be a data URL)
            const originalUrl = tile._originalWMSUrl;
            if (originalUrl && !originalUrl.startsWith('data:')) {
                retryTile(tile, originalUrl, 1, retryDelay);
            } else {
                console.warn('🌊 Cannot retry tile: No valid WMS URL available for tile', tile);
                // Don't let failed tiles accumulate errors
                if (consecutiveErrors > 0) consecutiveErrors--;
            }
        }, retryDelay);
    };

    const retryTile = (tile, originalSrc, attempt, customDelay = RETRY_DELAY) => {
        if (attempt <= RETRY_LIMIT && originalSrc && !originalSrc.startsWith('data:')) {
            setTimeout(() => {
                // Force tile refresh to bypass cache issues that might be causing HTTP/2 errors
                const refreshedSrc = originalSrc.includes('?') 
                    ? `${originalSrc}&_retry=${attempt}&_t=${Date.now()}`
                    : `${originalSrc}?_retry=${attempt}&_t=${Date.now()}`;
                
                // Clear the tile source first to force reload
                tile.src = '';
                
                // Set up success and error handlers before setting new source
                const oldOnLoad = tile.onload;
                const oldOnError = tile.onerror;
                
                tile.onload = () => {
                    consecutiveErrors = Math.max(0, consecutiveErrors - 1);
                    if (consecutiveErrors === 0) {
                        console.log('🌊 Marine forecast tiles loading successfully');
                        serverErrorNotified = false;
                    }
                    // Restore original onload if it existed
                    if (oldOnLoad && typeof oldOnLoad === 'function') {
                        oldOnLoad.call(tile);
                    }
                };
                
                tile.onerror = () => {
                    // Only retry if we haven't exceeded the limit
                    if (attempt < RETRY_LIMIT) {
                        retryTile(tile, originalSrc, attempt + 1, customDelay);
                    } else {
                        console.error(`Failed to load WMS tile after ${RETRY_LIMIT} attempts:`, originalSrc);
                        // Restore original onerror if it existed
                        if (oldOnError && typeof oldOnError === 'function') {
                            oldOnError.call(tile);
                        }
                    }
                };
                
                // Set the new source
                tile.src = refreshedSrc;
            }, customDelay);
        } else if (originalSrc && originalSrc.startsWith('data:')) {
            console.warn('🌊 Skipping retry for data URL - no original WMS URL available');
        } else {
            console.error(`Failed to load WMS tile after ${RETRY_LIMIT} attempts:`, originalSrc);
        }
    };

    wmsLayer.on('tileerror', handleTileError);

    // Store the getFeatureInfo function on the layer for external use (returns Promise)
    wmsLayer.getFeatureInfo = function(latlng, requestOptions = {}) {
        return getFeatureInfo(latlng, url, wmsLayer, map, options, handleShow, requestOptions);
    };

    // Function to retrieve GetFeatureInfo from WMS (returns Promise)
    const getFeatureInfo = (latlng, url, wmsLayer, map, options, handleShow, requestOptions = {}) => {
        return new Promise((resolve, reject) => {
            const point = map.latLngToContainerPoint(latlng, map.getZoom());
            const size = map.getSize();
            
            // Check if this is an ncWMS layer (EPSG:4326) or regular WMS (EPSG:3857)
            const isNcWMS = url.includes('ncWMS') || url.includes('ncwms');
            const targetCRS = 'EPSG:4326'; // Set to always use 4326.
            
            let bbox;
            if (isNcWMS) {
                // For EPSG:4326, use lat/lng bounds directly with proper axis order for WMS 1.3.0
                const bounds = map.getBounds();
                const version = wmsLayer.options.version || '1.3.0';
                if (version === '1.3.0') {
                    // WMS 1.3.0 with EPSG:4326 expects lat,lon,lat,lon order
                    bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
                } else {
                    // WMS 1.1.1 expects lon,lat,lon,lat order
                    bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
                }
            } else {
                // For EPSG:3857, use the standard bbox
                bbox = map.getBounds().toBBoxString();
            }

            // Only include parameters valid for GetFeatureInfo (exclude style-specific params)
            const params = {
                request: 'GetFeatureInfo',
                service: 'WMS',
                crs: targetCRS,
                styles: wmsLayer.options.styles,
                transparent: wmsLayer.options.transparent,
                version: wmsLayer.options.version || '1.3.0',
                format: wmsLayer.options.format,
                bbox: bbox,
                height: Math.round(size.y),
                width: Math.round(size.x),
                layers: wmsLayer.options.layers,
                query_layers: wmsLayer.options.layers,
                info_format: 'text/html', // Request HTML format
            };

            // Add time parameter if present (valid for both GetMap and GetFeatureInfo)
            if (wmsLayer.options.time) {
                params.time = wmsLayer.options.time;
            }

            // For WMS 1.3.0, use i/j instead of x/y
            const xParam = params.version === '1.3.0' ? 'i' : 'x';
            const yParam = params.version === '1.3.0' ? 'j' : 'y';
            params[xParam] = Math.round(point.x);
            params[yParam] = Math.round(point.y);

            const featureInfoUrl = url + L.Util.getParamString(params, url, true);
          
          // Proxy the GetFeatureInfo request
           // const proxyUrl = `/wms-proxy?url=${encodeURIComponent(featureInfoUrl)}`;
          
          
          
          
          
          
          
          
          
          
          
          
            // Gather extra info to send to handleShow
            const featureInfoBase = {
                id: id, // Use the separated id here
                latlng,
                layerName: wmsLayer.options.layers,
                bbox,
                [xParam]: params[xParam],
                [yParam]: params[yParam],
                height: params.height,
                width: params.width,
                style: wmsLayer.options.styles || "",
                timeDimension: wmsLayer.options.time || options.time || "",
                featureInfo: "Loading..."
            };

            // Immediately update the canvas with the basic info and "Loading..."
            const shouldAutoShow = requestOptions.autoShow !== false;

            if (shouldAutoShow && typeof handleShow === "function") {
                handleShow(featureInfoBase);
            }

          $.ajax({
                url: featureInfoUrl,
                success: function (data) {
                    let featureInfo = "No Data";
                    
                   //  Try parsing as HTML table
                    const doc = (new DOMParser()).parseFromString(data, "text/html");
                    if (doc.body.innerHTML.trim().length > 0) {
                        // Try parsing as HTML table
                        const p = doc.getElementsByTagName('td');
                        if (p.length > 5) {
                            featureInfo = p[5] ? p[5].textContent.trim() : "No Data";
                            const num = Number(featureInfo);
                            if (!isNaN(num)) {
                                featureInfo = num.toFixed(2);
                            }
                        }
                    }

                    // // First try to parse as JSON (CoverageJSON format)
                    // try {
                    //     if (typeof data === 'string' && data.trim().startsWith('{')) {
                    //         const jsonData = JSON.parse(data);
                            
                    //         // Handle CoverageJSON format
                    //         if (jsonData.type === "Coverage" && jsonData.ranges) {
                    //             const parameters = Object.keys(jsonData.ranges);
                    //             if (parameters.length > 0) {
                    //                 const paramName = parameters[0];
                    //                 const values = jsonData.ranges[paramName].values;
                                    
                    //                 // Find the first non-null value or current time index
                    //                 let value = null;
                    //                 if (Array.isArray(values)) {
                    //                     // Try to find value at current time or first non-null
                    //                     value = values.find(v => v !== null) || null;
                    //                 }
                                    
                    //                 if (value !== null && !isNaN(value)) {
                    //                     featureInfo = Number(value).toFixed(2);
                    //                 } else {
                    //                     featureInfo = "No Data Available";
                    //                 }
                    //             }
                    //         }
                    //     }
                    // } catch (jsonError) {
                    //     // If JSON parsing fails, fall back to "No Data"
                    //     featureInfo = "No Data";
                    //     console.log("JSON parse error, falling back to No Data");
                    //     console.error(jsonError);
                    // }

                    const result = {
                        ...featureInfoBase,
                        featureInfo
                    };

                    // Update canvas with all info including parsed value
                    if (shouldAutoShow && typeof handleShow === "function") {
                        handleShow(result);
                    }

                    // Option 3: Auto-open bottom canvas (skip popup)
                    // showFeatureInfoPopup(featureInfo, latlng, map, featureInfoBase, handleShow);
                    
                    // Resolve the Promise with the result
                    resolve(result);
                },
                error: function (xhr, status, error) {
                    const errorResult = {
                        ...featureInfoBase,
                        featureInfo: "Error fetching data"
                    };

                    // Show error in canvas
                    if (shouldAutoShow && typeof handleShow === "function") {
                        handleShow(errorResult);
                    }
                    
                    // Reject the Promise with error info
                    reject(new Error(`GetFeatureInfo failed: ${status} - ${error}`));
                }
            });
        });
    };

    return wmsLayer; // Return the layer instance
};

export default addWMSTileLayer;
