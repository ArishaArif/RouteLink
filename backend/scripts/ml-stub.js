const http = require('http');

const PORT = Number.parseInt(process.env.ML_STUB_PORT, 10) || 8099;

const CATALOG = [
  { name: 'Hunza Valley', category: 'valley', province: 'Gilgit-Baltistan' },
  { name: 'Passu Cones', category: 'mountain', province: 'Gilgit-Baltistan' },
  { name: 'Borith Lake', category: 'lake', province: 'Gilgit-Baltistan' },
  { name: 'Khunjerab Pass', category: 'mountain pass', province: 'Gilgit-Baltistan' },
  { name: 'Rakaposhi View Point', category: 'viewpoint', province: 'Gilgit-Baltistan' },
  { name: 'Skardu', category: 'town', province: 'Gilgit-Baltistan' },
  { name: 'Shangrila Resort', category: 'lake', province: 'Gilgit-Baltistan' },
  { name: 'Deosai National Park', category: 'plateau', province: 'Gilgit-Baltistan' },
  { name: 'Fairy Meadows', category: 'meadow', province: 'Gilgit-Baltistan' },
];

function respond(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return respond(res, 200, { status: 'ok', service: 'RouteLink ML Stub' });
  }

  const similarMatch = url.pathname.match(/^\/api\/recommend\/similar\/(.+)$/);
  if (req.method === 'POST' && similarMatch) {
    const requested = decodeURIComponent(similarMatch[1]);
    const known = CATALOG.some((row) => row.name.toLowerCase() === requested.toLowerCase());
    if (!known) {
      return respond(res, 404, { detail: `Destination '${requested}' not found in catalog` });
    }

    const topN = Number.parseInt(url.searchParams.get('top_n'), 10) || 5;
    const exclude = new Set(url.searchParams.getAll('exclude').map((name) => name.trim().toLowerCase()));

    const rows = CATALOG
      .filter((row) => row.name.toLowerCase() !== requested.toLowerCase())
      .filter((row) => !exclude.has(row.name.toLowerCase()))
      .slice(0, topN)
      .map((row, index) => ({ ...row, similarity_score: Number((0.91 - index * 0.05).toFixed(3)) }));

    return respond(res, 200, rows);
  }

  return respond(res, 404, { detail: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`ML stub listening on http://localhost:${PORT}`);
});
