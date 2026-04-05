const http = require('http');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const PORT = process.env.PORT || 8080;

// Initialize Firebase Admin SDK
// On Firebase App Hosting / Cloud Run, Application Default Credentials are
// provided automatically. For local dev, set GOOGLE_APPLICATION_CREDENTIALS
// to point to your downloaded service account key JSON file.
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const CAFES_COLLECTION = 'cafes';

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

const server = http.createServer(async (req, res) => {
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

        // GET /api/cafes — return all cafes
        if (req.method === 'GET' && req.url === '/api/cafes') {
            try {
                const snapshot = await db.collection(CAFES_COLLECTION).get();
                const cafes = snapshot.docs.map(doc => doc.data());
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(cafes));
            } catch (e) {
                console.error('GET /api/cafes error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to load cafes' }));
            }
            return;
        }

        // POST /api/cafes — add a new cafe
        if (req.method === 'POST' && req.url === '/api/cafes') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
                try {
                    const newCafe = JSON.parse(body);
                    await db.collection(CAFES_COLLECTION).doc(newCafe.id).set(newCafe);
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, cafe: newCafe }));
                } catch (e) {
                    console.error('POST /api/cafes error:', e);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to save cafe' }));
                }
            });
            return;
        }

        // PUT /api/cafes/:id — update rating and optionally add a review
        if (req.method === 'PUT') {
            const id = req.url.split('/').pop();
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
                try {
                    const payload = JSON.parse(body);
                    const docRef = db.collection(CAFES_COLLECTION).doc(id);
                    const docSnap = await docRef.get();

                    if (!docSnap.exists) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Cafe not found' }));
                        return;
                    }

                    const cafe = docSnap.data();
                    cafe.rating = payload.rating;

                    if (payload.reviewText) {
                        cafe.reviews.unshift({
                            name: 'You (Edited)',
                            rating: payload.rating,
                            text: payload.reviewText
                        });
                    }

                    await docRef.set(cafe);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, cafe }));
                } catch (e) {
                    console.error(`PUT /api/cafes/${id} error:`, e);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update cafe' }));
                }
            });
            return;
        }

        // DELETE /api/cafes/:id — remove a cafe
        if (req.method === 'DELETE') {
            const id = req.url.split('/').pop();
            try {
                const docRef = db.collection(CAFES_COLLECTION).doc(id);
                const docSnap = await docRef.get();

                if (!docSnap.exists) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Cafe not found' }));
                    return;
                }

                await docRef.delete();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error(`DELETE /api/cafes/${id} error:`, e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to delete cafe' }));
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
