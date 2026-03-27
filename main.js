import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// Scene Setup
// ============================================
const canvas = document.getElementById('globe-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 3.2);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ============================================
// Controls — interactive globe
// ============================================
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.8;
controls.minDistance = 1.8;
controls.maxDistance = 6;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

// ============================================
// Lighting
// ============================================
const ambientLight = new THREE.AmbientLight(0x334466, 1.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.position.set(5, 3, 5);
scene.add(sunLight);

const backLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
backLight.position.set(-5, -2, -5);
scene.add(backLight);

// ============================================
// Earth Globe
// ============================================
const textureLoader = new THREE.TextureLoader();

// Use reliable NASA Blue Marble textures from a fast CDN
const earthDayMap = textureLoader.load(
  'https://unpkg.com/three-globe@2.34.1/example/img/earth-blue-marble.jpg'
);
const earthTopology = textureLoader.load(
  'https://unpkg.com/three-globe@2.34.1/example/img/earth-topology.png'
);

const earthGeometry = new THREE.SphereGeometry(1, 128, 128);
const earthMaterial = new THREE.MeshStandardMaterial({
  map: earthDayMap,
  bumpMap: earthTopology,
  bumpScale: 0.03,
  roughness: 0.7,
  metalness: 0.1,
});

const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

// ============================================
// Atmosphere Glow
// ============================================
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = 1.0 - dot(viewDir, vNormal);
    fresnel = pow(fresnel, 3.0) * 1.2;
    vec3 color = mix(vec3(0.22, 0.74, 0.97), vec3(0.36, 0.5, 1.0), fresnel);
    gl_FragColor = vec4(color, fresnel * 0.6);
  }
`;

const atmosphereGeometry = new THREE.SphereGeometry(1.04, 64, 64);
const atmosphereMaterial = new THREE.ShaderMaterial({
  vertexShader: atmosphereVertexShader,
  fragmentShader: atmosphereFragmentShader,
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
});

const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
scene.add(atmosphere);

// Inner glow
const innerGlowGeometry = new THREE.SphereGeometry(1.015, 64, 64);
const innerGlowMaterial = new THREE.ShaderMaterial({
  vertexShader: atmosphereVertexShader,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = 1.0 - dot(viewDir, vNormal);
      fresnel = pow(fresnel, 4.0);
      gl_FragColor = vec4(0.22, 0.74, 0.97, fresnel * 0.3);
    }
  `,
  side: THREE.FrontSide,
  transparent: true,
  depthWrite: false,
});

const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
scene.add(innerGlow);

// ============================================
// Data Points — major cities
// ============================================
const cities = [
  { name: 'New York', lat: 40.71, lon: -74.01, gdp: '$1.8T' },
  { name: 'London', lat: 51.51, lon: -0.13, gdp: '$1.0T' },
  { name: 'Tokyo', lat: 35.68, lon: 139.69, gdp: '$2.0T' },
  { name: 'Shanghai', lat: 31.23, lon: 121.47, gdp: '$0.7T' },
  { name: 'Singapore', lat: 1.35, lon: 103.82, gdp: '$0.4T' },
  { name: 'Dubai', lat: 25.20, lon: 55.27, gdp: '$0.3T' },
  { name: 'São Paulo', lat: -23.55, lon: -46.63, gdp: '$0.5T' },
  { name: 'Mumbai', lat: 19.08, lon: 72.88, gdp: '$0.4T' },
  { name: 'Sydney', lat: -33.87, lon: 151.21, gdp: '$0.3T' },
  { name: 'Lagos', lat: 6.52, lon: 3.38, gdp: '$0.1T' },
  { name: 'Toronto', lat: 43.65, lon: -79.38, gdp: '$0.3T' },
  { name: 'Berlin', lat: 52.52, lon: 13.41, gdp: '$0.2T' },
  { name: 'Seoul', lat: 37.57, lon: 126.98, gdp: '$0.9T' },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17, gdp: '$0.4T' },
  { name: 'San Francisco', lat: 37.77, lon: -122.42, gdp: '$0.6T' },
  { name: 'Paris', lat: 48.86, lon: 2.35, gdp: '$0.8T' },
  { name: 'Nairobi', lat: -1.29, lon: 36.82, gdp: '$0.03T' },
  { name: 'Mexico City', lat: 19.43, lon: -99.13, gdp: '$0.2T' },
];

function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Create point markers
const pointsGroup = new THREE.Group();
scene.add(pointsGroup);

const markerGeometry = new THREE.SphereGeometry(0.012, 16, 16);
const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

const cityMeshes = [];

cities.forEach((city) => {
  const pos = latLonToVec3(city.lat, city.lon, 1.01);

  // Marker dot
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.position.copy(pos);
  marker.userData = city;
  pointsGroup.add(marker);
  cityMeshes.push(marker);

  // Pulse ring
  const ringGeometry = new THREE.RingGeometry(0.015, 0.025, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.copy(pos);
  ring.lookAt(pos.clone().multiplyScalar(2));
  ring.userData.phase = Math.random() * Math.PI * 2;
  pointsGroup.add(ring);

  // Vertical beam
  const beamGeometry = new THREE.CylinderGeometry(0.002, 0.002, 0.08, 8);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.4,
  });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  const beamPos = latLonToVec3(city.lat, city.lon, 1.05);
  beam.position.copy(beamPos);
  beam.lookAt(beamPos.clone().multiplyScalar(2));
  beam.rotateX(Math.PI / 2);
  pointsGroup.add(beam);
});

// ============================================
// Connection Arcs between major trade routes
// ============================================
const arcRoutes = [
  [0, 1],  // NY - London
  [0, 2],  // NY - Tokyo
  [1, 3],  // London - Shanghai
  [2, 4],  // Tokyo - Singapore
  [5, 7],  // Dubai - Mumbai
  [0, 6],  // NY - São Paulo
  [1, 8],  // London - Sydney
  [3, 13], // Shanghai - Hong Kong
  [14, 2], // SF - Tokyo
  [1, 15], // London - Paris
  [12, 3], // Seoul - Shanghai
  [0, 10], // NY - Toronto
];

function createArc(startPos, endPos) {
  const mid = startPos.clone().add(endPos).multiplyScalar(0.5);
  const dist = startPos.distanceTo(endPos);
  mid.normalize().multiplyScalar(1 + dist * 0.4);

  const curve = new THREE.QuadraticBezierCurve3(startPos, mid, endPos);
  const points = curve.getPoints(64);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  const material = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.15,
  });

  return new THREE.Line(geometry, material);
}

arcRoutes.forEach(([i, j]) => {
  const startPos = latLonToVec3(cities[i].lat, cities[i].lon, 1.01);
  const endPos = latLonToVec3(cities[j].lat, cities[j].lon, 1.01);
  const arc = createArc(startPos, endPos);
  scene.add(arc);
});

// ============================================
// Animated data packets along arcs
// ============================================
const packets = [];
const packetGeometry = new THREE.SphereGeometry(0.006, 8, 8);
const packetMaterial = new THREE.MeshBasicMaterial({
  color: 0x34d399,
  transparent: true,
  opacity: 0.9,
});

arcRoutes.forEach(([i, j]) => {
  const startPos = latLonToVec3(cities[i].lat, cities[i].lon, 1.01);
  const endPos = latLonToVec3(cities[j].lat, cities[j].lon, 1.01);
  const mid = startPos.clone().add(endPos).multiplyScalar(0.5);
  const dist = startPos.distanceTo(endPos);
  mid.normalize().multiplyScalar(1 + dist * 0.4);

  const curve = new THREE.QuadraticBezierCurve3(startPos, mid, endPos);

  const packet = new THREE.Mesh(packetGeometry, packetMaterial.clone());
  packet.userData.curve = curve;
  packet.userData.t = Math.random();
  packet.userData.speed = 0.002 + Math.random() * 0.003;
  scene.add(packet);
  packets.push(packet);
});

// ============================================
// Star Field Background
// ============================================
const starCount = 3000;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 50 + Math.random() * 100;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = r * Math.cos(phi);
}

const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.15,
  transparent: true,
  opacity: 0.6,
  sizeAttenuation: true,
});
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// ============================================
// Raycaster for hover interaction
// ============================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const globeLabel = document.getElementById('globe-label');
let hoveredCity = null;

canvas.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cityMeshes);

  if (intersects.length > 0) {
    const city = intersects[0].object.userData;
    hoveredCity = city;
    globeLabel.textContent = `${city.name} — GDP ${city.gdp}`;
    globeLabel.classList.remove('hidden');
    globeLabel.style.left = event.clientX + 16 + 'px';
    globeLabel.style.top = event.clientY - 16 + 'px';
    canvas.style.cursor = 'pointer';
    controls.autoRotate = false;
  } else {
    hoveredCity = null;
    globeLabel.classList.add('hidden');
    canvas.style.cursor = 'grab';
    controls.autoRotate = true;
  }
});

// ============================================
// Mini Chart Drawing
// ============================================
function createMiniChart(containerId, color, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cvs = document.createElement('canvas');
  container.appendChild(cvs);
  const ctx = cvs.getContext('2d');
  const w = container.offsetWidth || 220;
  const h = container.offsetHeight || 40;
  cvs.width = w * 2;
  cvs.height = h * 2;
  cvs.style.width = w + 'px';
  cvs.style.height = h + 'px';
  ctx.scale(2, 2);

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  data.forEach((val, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((val - min) / range) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill gradient
  const lastX = w;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2;
  ctx.lineTo(lastX, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '30');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.fill();
}

// Generate some random chart data
function genData(base, variance, len) {
  const data = [base];
  for (let i = 1; i < len; i++) {
    data.push(data[i - 1] + (Math.random() - 0.4) * variance);
  }
  return data;
}

createMiniChart('chart-gdp', '#34d399', genData(90, 3, 30));
createMiniChart('chart-trade', '#38bdf8', genData(5, 1, 30));
createMiniChart('chart-users', '#a78bfa', genData(4, 0.5, 30));
createMiniChart('chart-crypto', '#fbbf24', genData(2, 0.8, 30));

// ============================================
// Clock
// ============================================
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
updateClock();
setInterval(updateClock, 1000);

// ============================================
// Animate transaction counter
// ============================================
const txEl = document.getElementById('tx-value');
let txCount = 2847391;
setInterval(() => {
  txCount += Math.floor(Math.random() * 200 - 50);
  txEl.textContent = txCount.toLocaleString();
}, 100);

// ============================================
// Resize Handler
// ============================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// Animation Loop
// ============================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Slow earth rotation
  earth.rotation.y += 0.0003;

  // Pulse rings
  pointsGroup.children.forEach((child) => {
    if (child.geometry?.type === 'RingGeometry') {
      const phase = child.userData.phase || 0;
      const scale = 1 + Math.sin(elapsed * 2 + phase) * 0.5;
      child.scale.set(scale, scale, scale);
      child.material.opacity = 0.6 - Math.sin(elapsed * 2 + phase) * 0.3;
    }
  });

  // Move data packets
  packets.forEach((packet) => {
    packet.userData.t += packet.userData.speed;
    if (packet.userData.t > 1) packet.userData.t = 0;
    const pos = packet.userData.curve.getPoint(packet.userData.t);
    packet.position.copy(pos);
    // Fade at ends
    const t = packet.userData.t;
    packet.material.opacity = Math.sin(t * Math.PI) * 0.9;
  });

  controls.update();
  renderer.render(scene, camera);
}

animate();
