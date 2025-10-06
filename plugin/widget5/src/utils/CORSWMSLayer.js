/**
 * CORS-enabled WMS Layer for Leaflet
 * Handles THREDDS server requests that are blocked by standard CORS policies
 */

import L from 'leaflet';

/**
 * Create a custom WMS layer that can handle CORS-restricted servers
 */
export const createCORSWMSLayer = (url, options = {}) => {
  const CORSWMSLayer = L.TileLayer.WMS.extend({
    
    initialize: function(url, options) {
      L.TileLayer.WMS.prototype.initialize.call(this, url, options);
      
      // Enable CORS for THREDDS servers
      if (url.includes('thredds')) {
        this.options.crossOrigin = 'anonymous';
      }
    },

    createTile: function(coords, done) {
      const tile = document.createElement('img');
      
      // Set up CORS handling
      if (this.options.crossOrigin !== null) {
        tile.crossOrigin = this.options.crossOrigin;
      }

      // Add event listeners
      L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
      L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));

      // Handle abort
      if (this.options.crossOrigin === false) {
        tile.crossOrigin = '';
      }

      tile.alt = '';
      tile.setAttribute('role', 'presentation');

      // Generate the tile URL
      const tileUrl = this.getTileUrl(coords);
      
      // For THREDDS servers, try to load with CORS headers
      if (this._url.includes('thredds')) {
        this._loadTileWithCORS(tile, tileUrl, done);
      } else {
        tile.src = tileUrl;
      }

      return tile;
    },

    _loadTileWithCORS: function(tile, url, done) {
      // Try to load the tile using fetch first (for better CORS handling)
      fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'image/png,image/*,*/*'
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        const objectURL = URL.createObjectURL(blob);
        tile.src = objectURL;
        
        // Clean up object URL after tile loads
        tile.addEventListener('load', () => {
          URL.revokeObjectURL(objectURL);
        }, { once: true });
      })
      .catch(error => {
        console.log(`CORS fetch failed, falling back to direct load: ${error.message}`);
        // Fallback to direct image loading
        tile.src = url;
      });
    },

    _tileOnLoad: function(done, tile) {
      // Delete the crossOrigin attribute to avoid memory leaks
      if (tile.crossOrigin) {
        tile.removeAttribute('crossorigin');
      }
      done(null, tile);
    },

    _tileOnError: function(done, tile, e) {
      done(e, tile);
    }
  });

  return new CORSWMSLayer(url, options);
};

export default createCORSWMSLayer;