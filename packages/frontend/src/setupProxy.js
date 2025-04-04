const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api', // Proxy requests starting with "/api"
    createProxyMiddleware({
      target: (process.env.REACT_APP_API_URL || 'http://localhost:5000')+'/api', // Backend URL
      changeOrigin: true, // Changes the origin of the host header to the target URL
    })
  );
};
