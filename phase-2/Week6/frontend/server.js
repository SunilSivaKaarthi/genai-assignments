const http = require('http');
const fs = require('fs');
const path = require('path');

const frontendPort = process.env.FRONTEND_PORT || 4173;
const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';
const root = __dirname;
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function proxyApi(request, response) {
  const target = new URL(request.url, apiBase);
  const proxyRequest = http.request(target, {
    method: request.method,
    headers: { ...request.headers, host: target.host }
  }, proxyResponse => {
    response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    proxyResponse.pipe(response);
  });
  proxyRequest.on('error', () => {
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Moderation API is unavailable.' }));
  });
  request.pipe(proxyRequest);
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api/')) return proxyApi(request, response);

  const requestedPath = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const filePath = path.join(root, requestedPath);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    return response.end('Forbidden');
  }
  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(404);
      return response.end('Not found');
    }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(file);
  });
});

server.listen(frontendPort, () => {
  console.log(`Moderation UI running on http://localhost:${frontendPort}`);
  console.log(`Proxying /api/* to ${apiBase}`);
});
