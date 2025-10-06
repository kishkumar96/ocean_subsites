# CORS Issue Resolution for THREDDS Server

## Problem Analysis
The Cross-Origin Read Blocking (CORB) errors occur because:
1. Browser security policies block cross-origin requests from `http://localhost:3000` to `https://gemthreddshpc.spc.int`
2. THREDDS server doesn't include proper CORS headers
3. 51 requests indicate retry attempts are failing repeatedly

## Implemented Solution: setupProxy.js

### Configuration File: `/src/setupProxy.js`
```javascript
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api/thredds',
    createProxyMiddleware({
      target: 'https://gemthreddshpc.spc.int',
      changeOrigin: true,
      secure: true,
      pathRewrite: {
        '^/api/thredds': '/thredds',
      },
      timeout: 30000,
      proxyTimeout: 30000,
      headers: {
        'Accept': 'image/png,image/*,*/*',
        'User-Agent': 'Marine-Forecast-Widget/1.0'
      }
    })
  );
};
```

### URL Changes Made

#### WorldClassVisualization.js
```javascript
// Before (CORS blocked):
wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc"

// After (proxied):
wmsUrl: "/api/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc"
```

#### BottomBuoyOffCanvas.jsx
```javascript
// Before:
const LATEST_CAPABILITY_URL = "https://gemthreddshpc.spc.int/thredds/wms/..."

// After:
const LATEST_CAPABILITY_URL = "/api/thredds/wms/..."
```

## How It Works

1. **Request Flow**: 
   - Browser → `http://localhost:3000/api/thredds/...` (same-origin ✅)
   - Proxy → `https://gemthreddshpc.spc.int/thredds/...` (server-to-server ✅)

2. **CORS Resolution**:
   - No cross-origin request from browser
   - Proxy handles server-to-server communication
   - Returns data with proper CORS headers

3. **Automatic Integration**:
   - Create React App automatically loads `setupProxy.js`
   - No additional configuration needed
   - Works in development and can be deployed with nginx

## Testing the Solution

### 1. Start Development Server
```bash
cd /home/kishank/ocean_subsites/plugin/widget5
npm start
```

### 2. Test Proxy Endpoint
```bash
curl "http://localhost:3000/api/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc?service=WMS&version=1.3.0&request=GetCapabilities"
```

### 3. Verify Wave Direction Loading
- Open browser to `http://localhost:3000`
- Select "🌊 Wave Height + Direction" layer
- Check browser network tab for successful `/api/thredds/` requests
- Verify wave direction arrows appear on map

## Production Deployment

For production, update nginx configuration to proxy THREDDS requests:

```nginx
location /api/thredds/ {
    proxy_pass https://gemthreddshpc.spc.int/thredds/;
    proxy_set_header Host gemthreddshpc.spc.int;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # CORS headers
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
    add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
    
    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 204;
    }
}
```

## Expected Results

✅ **No more CORB errors**
✅ **Wave direction arrows display correctly**  
✅ **Reduced retry attempts (from 51 to normal)**
✅ **Faster tile loading**
✅ **Composite wave height + direction layers work**

## Troubleshooting

### If proxy doesn't work:
1. Check that `http-proxy-middleware` is installed
2. Restart development server after adding setupProxy.js
3. Verify URLs start with `/api/thredds/`
4. Check browser network tab for proxy requests

### If still getting CORS errors:
1. Clear browser cache
2. Check for hardcoded `https://gemthreddshpc.spc.int` URLs
3. Verify setupProxy.js syntax is correct
4. Test with a simple capabilities request first

## Dependencies Added
```json
{
  "devDependencies": {
    "http-proxy-middleware": "^x.x.x",
    "cors": "^x.x.x"
  }
}
```

This solution resolves the CORS issue while maintaining the accurate wave direction data from the THREDDS server.