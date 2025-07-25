const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Kishor@2025',
  database: 'hospital_nav'
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ Connected to MySQL');
});

function buildGraph(callback) {
  const graph = {};
  db.query('SELECT * FROM edges', (err, edges) => {
    if (err) return callback(err);
    edges.forEach(edge => {
      if (!graph[edge.from_id]) graph[edge.from_id] = [];
      if (!graph[edge.to_id]) graph[edge.to_id] = [];
      graph[edge.from_id].push([edge.to_id, edge.distance]);
      graph[edge.to_id].push([edge.from_id, edge.distance]);
    });
    callback(null, graph);
  });
}

function dijkstra(graph, start, end) {
  const distances = {}, prev = {}, queue = new Set(Object.keys(graph));
  for (let node of queue) {
    distances[node] = Infinity;
    prev[node] = null;
  }
  distances[start] = 0;

  while (queue.size) {
    let u = [...queue].reduce((a, b) => distances[a] < distances[b] ? a : b);
    queue.delete(u);
    if (u == end) break;
    for (let [v, weight] of graph[u]) {
      let alt = distances[u] + weight;
      if (alt < distances[v]) {
        distances[v] = alt;
        prev[v] = u;
      }
    }
  }

  const path = [];
  let u = end;
  while (u) {
    path.unshift(parseInt(u));
    u = prev[u];
  }

  return path;
}

app.get('/shortest-path', (req, res) => {
  const { from, to } = req.query;
  buildGraph((err, graph) => {
    if (err) return res.status(500).json({ error: 'Failed to build graph' });

    const path = dijkstra(graph, from, to);
    if (!path.length) return res.status(404).json({ error: 'No path found' });

    db.query('SELECT id, x, y FROM locations WHERE id IN (?)', [path], (err, locations) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch coordinates' });

      const locationMap = {};
      locations.forEach(loc => locationMap[loc.id] = [loc.x, loc.y]);

      const pathCoords = path.map(id => locationMap[id]).filter(coord => coord);

      res.json({ path: pathCoords });
    });
  });
});

app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Server running on all interfaces at http://<your-ip>:3000');
});
