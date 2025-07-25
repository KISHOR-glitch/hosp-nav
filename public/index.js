const urlParams = new URLSearchParams(window.location.search);
const fromValue = urlParams.get('from');
if (fromValue) {
  document.getElementById('from').value = fromValue;
}

const canvas = document.getElementById('map-overlay');
const ctx = canvas.getContext('2d');
let path = [], totalDistance = 0, walked = 0;

function drawMarkers(start, end) {
  const [sx, sy] = start;
  const [ex, ey] = end;

  // Start
  ctx.fillStyle = 'green';
  ctx.beginPath();
  ctx.arc(sx, sy, 8, 0, 2 * Math.PI);
  ctx.fill();

  // End
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(ex, ey, 8, 0, 2 * Math.PI);
  ctx.fill();
}

function drawPath(p) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  walked = 0;
  walkIndex = 0;
  path = p;

  ctx.strokeStyle = 'blue';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) {
    ctx.lineTo(p[i][0], p[i][1]);
  }
  ctx.stroke();

  ctx.fillStyle = 'red';
  p.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  });

  drawMarkers(p[0], p[p.length - 1]);

  totalDistance = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    totalDistance += Math.round(Math.hypot(x2 - x1, y2 - y1));
  }

  updateDistanceDisplay();
}

function updateDistanceDisplay() {
  const remaining = Math.max(totalDistance - walked, 0);
  document.getElementById('distance').textContent =
    `Walked: ${walked}m | Remaining: ${remaining}m`;
}

async function navigate() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  if (from === to) return alert("Please choose different locations");

  const res = await fetch(`/shortest-path?from=${from}&to=${to}`);
  const data = await res.json();
  if (data.path) drawPath(data.path);
  else alert("No path found");
}

function drawWalkProgress() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Full path in blue
  ctx.strokeStyle = 'blue';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i][0], path[i][1]);
  }
  ctx.stroke();

  // Green walked path
  let remaining = walked;
  ctx.strokeStyle = 'green';
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) {
    const [x1, y1] = path[i - 1];
    const [x2, y2] = path[i];
    const segLen = Math.round(Math.hypot(x2 - x1, y2 - y1));

    if (remaining >= segLen) {
      ctx.lineTo(x2, y2);
      remaining -= segLen;
    } else {
      const ratio = remaining / segLen;
      const xMid = x1 + (x2 - x1) * ratio;
      const yMid = y1 + (y2 - y1) * ratio;
      ctx.lineTo(xMid, yMid);
      break;
    }
  }
  ctx.stroke();

  // Redraw nodes
  ctx.fillStyle = 'red';
  path.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  });

  drawMarkers(path[0], path[path.length - 1]);
  updateDistanceDisplay();
}


function enableMotion() {
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    // iOS-style permission
    DeviceMotionEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          startMotionTracking();
        } else {
          alert('Motion permission denied.');
        }
      })
      .catch(console.error);
  } else {
    // Android or other browsers
    startMotionTracking();
  }
}

function startMotionTracking() {
  let lastStepTime = 0;

  window.addEventListener('devicemotion', (event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    const netAcc = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    const now = Date.now();

    if (netAcc > 12 && now - lastStepTime > 400) {
      lastStepTime = now;
      walked += 5;
      if (walked > totalDistance) walked = totalDistance;
      drawWalkProgress();
      updateDistanceDisplay();
    }
  });
}

// Optional: simulate walk button (if needed)
document.getElementById("walk").addEventListener("click", () => {
  walked += 10;
  if (walked > totalDistance) walked = totalDistance;
  drawWalkProgress();
});

// Live motion detection
if ('DeviceMotionEvent' in window) {
  window.addEventListener('devicemotion', (event) => {
    const acc = event.accelerationIncludingGravity;
    const netAcc = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);

    if (netAcc > 12) {
      walked += 5; // Tune step length
      if (walked > totalDistance) walked = totalDistance;
      drawWalkProgress();
    }
  });
} else {
  alert('Motion not supported on this device.');
}
let lastPosition = null;

function startGeoWalkTracking() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude } = pos.coords;

    if (lastPosition) {
      const dist = getDistanceFromLatLonInMeters(
        lastPosition.lat, lastPosition.lon, latitude, longitude
      );

      // Increase walked distance and update
      walked += Math.round(dist);
      if (walked > totalDistance) walked = totalDistance;

      drawWalkProgress();
      updateDistanceDisplay();
    }

    // Save current as last for next check
    lastPosition = { lat: latitude, lon: longitude };
  }, err => {
    alert("Error fetching GPS location: " + err.message);
  }, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 5000
  });
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

https://github.com/KISHOR-glitch/hosp-nav.git