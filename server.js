const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
// App Hosting/Cloud Run has a read-only file system except for /tmp
const isProd = process.env.NODE_ENV === 'production';
const DB_PATH = isProd ? path.join('/tmp', 'db.json') : path.join(__dirname, 'db.json');

// Bootstrapping the initial db file for production if it doesn't exist
if (isProd && !fs.existsSync(DB_PATH) && fs.existsSync(path.join(__dirname, 'db.json'))) {
  fs.copyFileSync(path.join(__dirname, 'db.json'), DB_PATH);
}

const MIME_TYPES = {
  default: 'application/octet-stream',
  html: 'text/html; charset=UTF-8',
  js: 'application/javascript',
  css: 'text/css',
  png: 'image/png',
  jpg: 'image/jpg',
  gif: 'image/gif',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
};

// Helper: read db
const readDB = () => {
    try {
        if(!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '[]');
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch(e) {
        return [];
    }
};

// Helper: write db
const writeDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

const server = http.createServer((req, res) => {
  // CORS purely to ensure UI fetches work locally easily
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle API routes
  if (req.url.startsWith('/api/cafes')) {
      if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(readDB()));
          return;
      }

      if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', () => {
              const newCafe = JSON.parse(body);
              const data = readDB();
              data.push(newCafe);
              writeDB(data);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, cafe: newCafe }));
          });
          return;
      }

      // Handle PUT /api/cafes/:id for ratings
      if (req.method === 'PUT') {
          const id = req.url.split('/').pop();
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', () => {
              const payload = JSON.parse(body);
              const data = readDB();
              const cafeIndex = data.findIndex(c => c.id === id);
              if(cafeIndex > -1) {
                  data[cafeIndex].rating = payload.rating;
                  // Push a fresh review if they requested
                  if (payload.reviewText) {
                      data[cafeIndex].reviews.unshift({
                          name: "You (Edited)",
                          rating: payload.rating,
                          text: payload.reviewText
                      });
                  }
                  writeDB(data);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, cafe: data[cafeIndex] }));
              } else {
                  res.writeHead(404, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: "Cafe not found" }));
              }
          });
          return;
      }

      // Handle DELETE /api/cafes/:id
      if (req.method === 'DELETE') {
          const id = req.url.split('/').pop();
          const data = readDB();
          const newData = data.filter(c => c.id !== id);
          if (data.length !== newData.length) {
              writeDB(newData);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
          } else {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: "Cafe not found" }));
          }
          return;
      }
  }

  // Handle Static Files
  const file = req.url === '/' ? '/index.html' : req.url;
  const safeStr = decodeURI(file).split('?')[0];
  const filePath = path.join(__dirname, safeStr);
  const ext = path.extname(filePath).substring(1).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found', 'utf-8');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || MIME_TYPES.default });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
