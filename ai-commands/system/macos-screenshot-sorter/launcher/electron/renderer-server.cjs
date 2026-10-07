const http = require('http');
const fs = require('fs');
const path = require('path');

const rendererDir = path.join(__dirname, 'renderer');
const indexHtml = path.join(rendererDir, 'index.html');

const server = http.createServer((req, res) => {
  let filePath = path.join(rendererDir, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json'
  };
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(8080, () => {
  console.log('Angular renderer server running on http://localhost:8080');
  console.log('Serving from:', rendererDir);
});
