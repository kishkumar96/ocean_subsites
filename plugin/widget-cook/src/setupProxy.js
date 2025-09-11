/* eslint-disable */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy requests to THREDDS WMS server to avoid CORS issues
  app.use(
    '/thredds-proxy',
    createProxyMiddleware({
      target: 'https://gemthreddshpc.spc.int',
      changeOrigin: true,
      pathRewrite: {
        '^/thredds-proxy': '', // Remove /thredds-proxy from the path
      },
      onProxyRes: function (proxyRes, req, res) {
        // Add CORS headers to the response
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
      },
      onError: function (err, req, res) {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end('Proxy error: ' + err.message);
      },
      logLevel: 'debug'
    })
  );

  app.use(
    '/spc-wms',
    createProxyMiddleware({
      target: 'https://gemthreddshpc.spc.int',
      changeOrigin: true,
      secure: true,
      logLevel: 'warn',
      timeout: 30000, // 30 second timeout
      proxyTimeout: 30000,
      followRedirects: true,
      pathRewrite: {
        '^/spc-wms': ''
      },
      onProxyReq(proxyReq, req) {
        // Optimize headers for better performance
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 WMS-Client');
        proxyReq.setHeader('Accept', 'image/png,image/jpeg,image/*;q=0.9,*/*;q=0.8');
        proxyReq.setHeader('Accept-Encoding', 'gzip, deflate');
        proxyReq.setHeader('Connection', 'keep-alive');
        
        // Only set no-cache for GetCapabilities requests, allow caching for tiles
        if (req.url.includes('GetCapabilities')) {
          proxyReq.setHeader('Cache-Control', 'no-cache');
        } else {
          proxyReq.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache for tiles
        }
      },
      onProxyRes: function (proxyRes, req, res) {
        // Add CORS headers
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
        
        // Enable compression and caching for tile responses
        if (!req.url.includes('GetCapabilities')) {
          proxyRes.headers['Cache-Control'] = 'public, max-age=300';
        }
      },
      onError: function (err, req, res) {
        console.error(`Proxy error for ${req.url}:`, err.message);
        res.writeHead(503, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ 
          error: 'Service temporarily unavailable',
          message: err.message,
          retry: true 
        }));
      }
    })
  );
};
