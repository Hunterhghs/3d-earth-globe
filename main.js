import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ============================================
// Scene Setup
// ============================================
const canvas = document.getElementById('globe-canvas');
const scene = new THREE.Scene();

const isMobileDevice = window.innerWidth <= 600 || ('ontouchstart' in window && window.innerWidth <= 768);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
// On mobile, zoom in closer so the globe fills the screen nicely
camera.position.set(0, isMobileDevice ? 0.2 : 0.4, isMobileDevice ? 2.6 : 3.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobileDevice, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Cap pixel ratio lower on mobile for performance
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileDevice ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// CSS2D Renderer for country labels
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'fixed';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
labelRenderer.domElement.style.zIndex = '5';
document.body.appendChild(labelRenderer.domElement);

// ============================================
// Controls
// ============================================
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = isMobileDevice ? 0.35 : 0.5;
controls.zoomSpeed = isMobileDevice ? 0.6 : 0.8;
controls.minDistance = isMobileDevice ? 1.6 : 1.8;
controls.maxDistance = 6;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

// ============================================
// Lighting — even illumination
// ============================================
scene.add(new THREE.AmbientLight(0xffffff, 3.0));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(5, 3, 5);
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
fillLight.position.set(-5, -2, -5);
scene.add(fillLight);
const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
topLight.position.set(0, 5, 0);
scene.add(topLight);

// ============================================
// Earth Globe
// ============================================
const textureLoader = new THREE.TextureLoader();
const earthDayMap = textureLoader.load('https://unpkg.com/three-globe@2.34.1/example/img/earth-blue-marble.jpg');
const earthTopology = textureLoader.load('https://unpkg.com/three-globe@2.34.1/example/img/earth-topology.png');

const earthGeometry = new THREE.SphereGeometry(1, 128, 128);
const earthMaterial = new THREE.MeshStandardMaterial({
  map: earthDayMap,
  bumpMap: earthTopology,
  bumpScale: 0.03,
  roughness: 1.0,
  metalness: 0.0,
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

// ============================================
// Atmosphere Glow
// ============================================
const atmosVert = `
  varying vec3 vNormal; varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmosFrag = `
  varying vec3 vNormal; varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float f = 1.0 - dot(viewDir, vNormal);
    f = pow(f, 3.0) * 1.2;
    vec3 c = mix(vec3(0.22,0.74,0.97), vec3(0.36,0.5,1.0), f);
    gl_FragColor = vec4(c, f * 0.5);
  }
`;
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.04, 64, 64),
  new THREE.ShaderMaterial({ vertexShader: atmosVert, fragmentShader: atmosFrag, side: THREE.BackSide, transparent: true, depthWrite: false })
);
scene.add(atmosphere);

const innerGlow = new THREE.Mesh(
  new THREE.SphereGeometry(1.015, 64, 64),
  new THREE.ShaderMaterial({
    vertexShader: atmosVert,
    fragmentShader: `
      varying vec3 vNormal; varying vec3 vPosition;
      void main() {
        vec3 v = normalize(-vPosition);
        float f = pow(1.0 - dot(v, vNormal), 4.0);
        gl_FragColor = vec4(0.22,0.74,0.97, f * 0.25);
      }
    `,
    side: THREE.FrontSide, transparent: true, depthWrite: false
  })
);
scene.add(innerGlow);

// ============================================
// Helpers
// ============================================
function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function hdiColor(hdi) {
  if (hdi >= 0.800) return 0x34d399;
  if (hdi >= 0.700) return 0x38bdf8;
  if (hdi >= 0.550) return 0xfbbf24;
  return 0xf87171;
}

function hdiColorCSS(hdi) {
  if (hdi >= 0.800) return '#34d399';
  if (hdi >= 0.700) return '#38bdf8';
  if (hdi >= 0.550) return '#fbbf24';
  return '#f87171';
}

// ============================================
// Country Development Data
// ============================================
const countries = [
  // North America
  { name:'United States', code:'US', lat:39.8, lon:-98.6, region:'North America', pop:'339M', gdp:'$28.8T', gdppc:'$85,373', hdi:0.927, lifeExp:77.2, literacy:99, internet:92.0, co2:13.0, gini:39.8, major:true },
  { name:'Canada', code:'CA', lat:56.1, lon:-106.3, region:'North America', pop:'41M', gdp:'$2.1T', gdppc:'$53,247', hdi:0.935, lifeExp:82.7, literacy:99, internet:93.5, co2:14.3, gini:33.3, major:true },
  { name:'Mexico', code:'MX', lat:23.6, lon:-102.5, region:'Latin America', pop:'130M', gdp:'$1.8T', gdppc:'$13,811', hdi:0.758, lifeExp:75.0, literacy:95.4, internet:75.6, co2:3.6, gini:45.4, major:true },

  // Central America & Caribbean
  { name:'Guatemala', code:'GT', lat:15.5, lon:-90.2, region:'Latin America', pop:'18M', gdp:'$102B', gdppc:'$5,573', hdi:0.627, lifeExp:71.8, literacy:81.3, internet:51.0, co2:1.1, gini:48.3, major:false },
  { name:'Costa Rica', code:'CR', lat:9.7, lon:-83.7, region:'Latin America', pop:'5.2M', gdp:'$70B', gdppc:'$13,576', hdi:0.806, lifeExp:80.3, literacy:98.0, internet:81.2, co2:1.6, gini:48.2, major:false },
  { name:'Cuba', code:'CU', lat:21.5, lon:-77.8, region:'Latin America', pop:'11M', gdp:'$107B', gdppc:'$9,478', hdi:0.764, lifeExp:78.8, literacy:99.8, internet:71.0, co2:1.9, gini:38.0, major:false },
  { name:'Jamaica', code:'JM', lat:18.1, lon:-77.3, region:'Latin America', pop:'3M', gdp:'$18B', gdppc:'$6,047', hdi:0.709, lifeExp:74.8, literacy:88.7, internet:82.0, co2:2.3, gini:35.0, major:false },
  { name:'Haiti', code:'HT', lat:19.0, lon:-72.1, region:'Latin America', pop:'12M', gdp:'$20B', gdppc:'$1,748', hdi:0.535, lifeExp:64.0, literacy:61.7, internet:39.0, co2:0.3, gini:41.1, major:false },

  // South America
  { name:'Brazil', code:'BR', lat:-14.2, lon:-51.9, region:'Latin America', pop:'216M', gdp:'$2.1T', gdppc:'$10,413', hdi:0.760, lifeExp:76.0, literacy:94.4, internet:81.3, co2:2.1, gini:48.9, major:true },
  { name:'Argentina', code:'AR', lat:-38.4, lon:-63.6, region:'Latin America', pop:'46M', gdp:'$621B', gdppc:'$13,709', hdi:0.842, lifeExp:77.1, literacy:99.0, internet:87.1, co2:3.9, gini:42.3, major:true },
  { name:'Colombia', code:'CO', lat:4.6, lon:-74.1, region:'Latin America', pop:'52M', gdp:'$334B', gdppc:'$6,630', hdi:0.752, lifeExp:77.3, literacy:95.6, internet:73.4, co2:1.6, gini:51.3, major:false },
  { name:'Chile', code:'CL', lat:-35.7, lon:-71.5, region:'Latin America', pop:'19M', gdp:'$301B', gdppc:'$15,356', hdi:0.855, lifeExp:80.2, literacy:96.8, internet:90.2, co2:4.3, gini:44.9, major:false },
  { name:'Peru', code:'PE', lat:-9.2, lon:-75.0, region:'Latin America', pop:'34M', gdp:'$242B', gdppc:'$7,126', hdi:0.762, lifeExp:76.7, literacy:94.5, internet:71.1, co2:1.6, gini:43.8, major:false },
  { name:'Venezuela', code:'VE', lat:6.4, lon:-66.6, region:'Latin America', pop:'28M', gdp:'$92B', gdppc:'$3,200', hdi:0.691, lifeExp:72.1, literacy:97.1, internet:72.0, co2:2.7, gini:44.8, major:false },

  // Europe
  { name:'United Kingdom', code:'GB', lat:55.4, lon:-3.4, region:'Europe', pop:'68M', gdp:'$3.5T', gdppc:'$48,913', hdi:0.929, lifeExp:80.7, literacy:99, internet:95.0, co2:4.7, gini:35.1, major:true },
  { name:'Germany', code:'DE', lat:51.2, lon:10.4, region:'Europe', pop:'84M', gdp:'$4.6T', gdppc:'$54,291', hdi:0.942, lifeExp:80.6, literacy:99, internet:93.0, co2:7.7, gini:31.7, major:true },
  { name:'France', code:'FR', lat:46.2, lon:2.2, region:'Europe', pop:'68M', gdp:'$3.1T', gdppc:'$44,408', hdi:0.903, lifeExp:82.5, literacy:99, internet:90.0, co2:4.3, gini:32.4, major:true },
  { name:'Italy', code:'IT', lat:41.9, lon:12.6, region:'Europe', pop:'59M', gdp:'$2.3T', gdppc:'$38,161', hdi:0.895, lifeExp:83.5, literacy:99.2, internet:87.0, co2:5.0, gini:35.9, major:true },
  { name:'Spain', code:'ES', lat:40.5, lon:-3.7, region:'Europe', pop:'48M', gdp:'$1.6T', gdppc:'$32,551', hdi:0.905, lifeExp:83.6, literacy:98.6, internet:93.2, co2:4.8, gini:34.7, major:true },
  { name:'Netherlands', code:'NL', lat:52.1, lon:5.3, region:'Europe', pop:'18M', gdp:'$1.1T', gdppc:'$62,448', hdi:0.946, lifeExp:81.7, literacy:99, internet:95.6, co2:7.8, gini:28.1, major:false },
  { name:'Sweden', code:'SE', lat:60.1, lon:18.6, region:'Europe', pop:'10.5M', gdp:'$593B', gdppc:'$56,361', hdi:0.947, lifeExp:83.2, literacy:99, internet:96.4, co2:3.6, gini:30.0, major:false },
  { name:'Norway', code:'NO', lat:60.5, lon:8.5, region:'Europe', pop:'5.5M', gdp:'$579B', gdppc:'$106,149', hdi:0.966, lifeExp:83.3, literacy:99, internet:98.4, co2:6.7, gini:27.6, major:false },
  { name:'Switzerland', code:'CH', lat:46.8, lon:8.2, region:'Europe', pop:'8.8M', gdp:'$884B', gdppc:'$99,994', hdi:0.962, lifeExp:83.4, literacy:99, internet:96.0, co2:3.8, gini:33.1, major:false },
  { name:'Poland', code:'PL', lat:51.9, lon:19.1, region:'Europe', pop:'38M', gdp:'$842B', gdppc:'$22,393', hdi:0.876, lifeExp:77.5, literacy:99.8, internet:87.7, co2:7.3, gini:29.7, major:false },
  { name:'Ukraine', code:'UA', lat:48.4, lon:31.2, region:'Europe', pop:'37M', gdp:'$161B', gdppc:'$4,534', hdi:0.773, lifeExp:73.6, literacy:99.8, internet:79.0, co2:3.5, gini:26.6, major:false },
  { name:'Romania', code:'RO', lat:45.9, lon:24.9, region:'Europe', pop:'19M', gdp:'$301B', gdppc:'$15,822', hdi:0.821, lifeExp:76.0, literacy:98.8, internet:84.4, co2:3.4, gini:34.8, major:false },
  { name:'Greece', code:'GR', lat:39.1, lon:21.8, region:'Europe', pop:'10.4M', gdp:'$239B', gdppc:'$22,440', hdi:0.887, lifeExp:80.1, literacy:97.9, internet:85.0, co2:5.3, gini:32.9, major:false },
  { name:'Portugal', code:'PT', lat:39.4, lon:-8.2, region:'Europe', pop:'10.3M', gdp:'$268B', gdppc:'$26,020', hdi:0.866, lifeExp:81.1, literacy:96.1, internet:85.3, co2:4.0, gini:33.8, major:false },
  { name:'Finland', code:'FI', lat:61.9, lon:25.7, region:'Europe', pop:'5.6M', gdp:'$300B', gdppc:'$53,654', hdi:0.940, lifeExp:81.9, literacy:99, internet:95.5, co2:6.5, gini:27.3, major:false },
  { name:'Ireland', code:'IE', lat:53.1, lon:-7.7, region:'Europe', pop:'5.1M', gdp:'$533B', gdppc:'$103,685', hdi:0.945, lifeExp:82.0, literacy:99, internet:92.0, co2:7.1, gini:30.6, major:false },

  // Russia & Central Asia
  { name:'Russia', code:'RU', lat:61.5, lon:105.3, region:'Europe/Asia', pop:'144M', gdp:'$2.2T', gdppc:'$15,345', hdi:0.822, lifeExp:73.2, literacy:99.7, internet:88.0, co2:10.8, gini:36.0, major:true },
  { name:'Kazakhstan', code:'KZ', lat:48.0, lon:68.0, region:'Central Asia', pop:'20M', gdp:'$261B', gdppc:'$13,190', hdi:0.802, lifeExp:71.4, literacy:99.8, internet:86.0, co2:12.1, gini:27.8, major:false },
  { name:'Uzbekistan', code:'UZ', lat:41.4, lon:64.6, region:'Central Asia', pop:'36M', gdp:'$90B', gdppc:'$2,568', hdi:0.727, lifeExp:72.0, literacy:99.6, internet:73.0, co2:3.2, gini:35.3, major:false },

  // Middle East
  { name:'Turkey', code:'TR', lat:38.9, lon:35.2, region:'Middle East', pop:'85M', gdp:'$1.1T', gdppc:'$13,110', hdi:0.838, lifeExp:76.0, literacy:96.7, internet:83.4, co2:5.1, gini:41.9, major:true },
  { name:'Saudi Arabia', code:'SA', lat:23.9, lon:45.1, region:'Middle East', pop:'37M', gdp:'$1.1T', gdppc:'$29,922', hdi:0.875, lifeExp:77.6, literacy:97.6, internet:97.9, co2:15.3, gini:45.9, major:true },
  { name:'UAE', code:'AE', lat:23.4, lon:53.8, region:'Middle East', pop:'10M', gdp:'$509B', gdppc:'$49,451', hdi:0.911, lifeExp:79.1, literacy:97.6, internet:99.0, co2:20.7, gini:32.5, major:false },
  { name:'Israel', code:'IL', lat:31.0, lon:34.9, region:'Middle East', pop:'9.8M', gdp:'$525B', gdppc:'$54,688', hdi:0.915, lifeExp:82.6, literacy:97.8, internet:90.3, co2:6.2, gini:38.6, major:false },
  { name:'Iran', code:'IR', lat:32.4, lon:53.7, region:'Middle East', pop:'89M', gdp:'$368B', gdppc:'$4,091', hdi:0.774, lifeExp:77.0, literacy:88.7, internet:79.0, co2:8.5, gini:40.9, major:true },
  { name:'Iraq', code:'IQ', lat:33.2, lon:43.7, region:'Middle East', pop:'44M', gdp:'$264B', gdppc:'$5,969', hdi:0.686, lifeExp:71.6, literacy:85.6, internet:75.0, co2:4.0, gini:29.5, major:false },
  { name:'Jordan', code:'JO', lat:30.6, lon:36.2, region:'Middle East', pop:'11M', gdp:'$50B', gdppc:'$4,660', hdi:0.736, lifeExp:75.1, literacy:98.2, internet:83.0, co2:2.4, gini:33.7, major:false },
  { name:'Yemen', code:'YE', lat:15.6, lon:48.5, region:'Middle East', pop:'34M', gdp:'$21B', gdppc:'$600', hdi:0.455, lifeExp:63.4, literacy:70.1, internet:27.0, co2:0.3, gini:36.7, major:false },

  // South Asia
  { name:'India', code:'IN', lat:20.6, lon:79.0, region:'South Asia', pop:'1.44B', gdp:'$3.9T', gdppc:'$2,730', hdi:0.644, lifeExp:70.8, literacy:74.4, internet:52.4, co2:1.9, gini:35.7, major:true },
  { name:'Pakistan', code:'PK', lat:30.4, lon:69.3, region:'South Asia', pop:'240M', gdp:'$340B', gdppc:'$1,505', hdi:0.544, lifeExp:67.3, literacy:58.0, internet:36.7, co2:0.9, gini:29.6, major:true },
  { name:'Bangladesh', code:'BD', lat:23.7, lon:90.4, region:'South Asia', pop:'173M', gdp:'$460B', gdppc:'$2,688', hdi:0.670, lifeExp:72.4, literacy:74.7, internet:38.9, co2:0.6, gini:32.4, major:false },
  { name:'Sri Lanka', code:'LK', lat:7.9, lon:80.8, region:'South Asia', pop:'22M', gdp:'$75B', gdppc:'$3,354', hdi:0.782, lifeExp:77.4, literacy:92.3, internet:52.0, co2:1.0, gini:39.3, major:false },
  { name:'Nepal', code:'NP', lat:28.4, lon:84.1, region:'South Asia', pop:'31M', gdp:'$42B', gdppc:'$1,337', hdi:0.601, lifeExp:70.8, literacy:67.9, internet:45.0, co2:0.4, gini:32.8, major:false },
  { name:'Afghanistan', code:'AF', lat:33.9, lon:67.7, region:'South Asia', pop:'42M', gdp:'$14B', gdppc:'$364', hdi:0.462, lifeExp:62.0, literacy:37.3, internet:18.0, co2:0.2, gini:31.6, major:false },

  // East Asia
  { name:'China', code:'CN', lat:35.9, lon:104.2, region:'East Asia', pop:'1.43B', gdp:'$18.5T', gdppc:'$12,970', hdi:0.788, lifeExp:78.2, literacy:97.3, internet:73.7, co2:8.0, gini:38.2, major:true },
  { name:'Japan', code:'JP', lat:36.2, lon:138.3, region:'East Asia', pop:'124M', gdp:'$4.2T', gdppc:'$33,950', hdi:0.920, lifeExp:84.8, literacy:99, internet:93.0, co2:8.0, gini:32.9, major:true },
  { name:'South Korea', code:'KR', lat:35.9, lon:127.8, region:'East Asia', pop:'52M', gdp:'$1.7T', gdppc:'$33,147', hdi:0.929, lifeExp:83.7, literacy:98, internet:97.6, co2:11.6, gini:31.4, major:true },
  { name:'Mongolia', code:'MN', lat:46.9, lon:103.8, region:'East Asia', pop:'3.4M', gdp:'$19B', gdppc:'$5,483', hdi:0.741, lifeExp:71.5, literacy:98.4, internet:63.0, co2:7.1, gini:32.7, major:false },
  { name:'Taiwan', code:'TW', lat:23.7, lon:121.0, region:'East Asia', pop:'24M', gdp:'$790B', gdppc:'$33,775', hdi:0.926, lifeExp:81.0, literacy:99, internet:93.0, co2:11.2, gini:33.6, major:false },

  // Southeast Asia
  { name:'Indonesia', code:'ID', lat:-0.8, lon:113.9, region:'Southeast Asia', pop:'277M', gdp:'$1.4T', gdppc:'$5,016', hdi:0.713, lifeExp:71.7, literacy:96.0, internet:66.5, co2:2.3, gini:37.9, major:true },
  { name:'Philippines', code:'PH', lat:12.9, lon:121.8, region:'Southeast Asia', pop:'117M', gdp:'$435B', gdppc:'$3,859', hdi:0.710, lifeExp:72.0, literacy:96.3, internet:68.0, co2:1.3, gini:42.3, major:false },
  { name:'Vietnam', code:'VN', lat:14.1, lon:108.3, region:'Southeast Asia', pop:'100M', gdp:'$449B', gdppc:'$4,475', hdi:0.726, lifeExp:75.4, literacy:95.8, internet:73.2, co2:3.5, gini:35.7, major:false },
  { name:'Thailand', code:'TH', lat:15.9, lon:101.0, region:'Southeast Asia', pop:'72M', gdp:'$535B', gdppc:'$7,336', hdi:0.800, lifeExp:78.7, literacy:93.8, internet:85.3, co2:3.8, gini:34.9, major:false },
  { name:'Malaysia', code:'MY', lat:4.2, lon:101.9, region:'Southeast Asia', pop:'34M', gdp:'$434B', gdppc:'$13,034', hdi:0.803, lifeExp:76.2, literacy:95.0, internet:89.6, co2:7.6, gini:41.2, major:false },
  { name:'Singapore', code:'SG', lat:1.35, lon:103.82, region:'Southeast Asia', pop:'5.9M', gdp:'$498B', gdppc:'$84,500', hdi:0.939, lifeExp:83.5, literacy:97.5, internet:96.9, co2:6.5, gini:45.9, major:false },
  { name:'Myanmar', code:'MM', lat:19.8, lon:96.2, region:'Southeast Asia', pop:'55M', gdp:'$59B', gdppc:'$1,095', hdi:0.585, lifeExp:69.1, literacy:89.1, internet:44.0, co2:0.5, gini:30.7, major:false },
  { name:'Cambodia', code:'KH', lat:12.6, lon:105.0, region:'Southeast Asia', pop:'17M', gdp:'$31B', gdppc:'$1,785', hdi:0.600, lifeExp:70.1, literacy:82.5, internet:60.0, co2:0.6, gini:37.9, major:false },

  // Africa — North
  { name:'Egypt', code:'EG', lat:26.8, lon:30.8, region:'North Africa', pop:'112M', gdp:'$387B', gdppc:'$3,699', hdi:0.731, lifeExp:72.0, literacy:73.1, internet:72.2, co2:2.2, gini:31.5, major:true },
  { name:'Morocco', code:'MA', lat:31.8, lon:-7.1, region:'North Africa', pop:'38M', gdp:'$141B', gdppc:'$3,795', hdi:0.683, lifeExp:76.7, literacy:75.9, internet:84.1, co2:1.8, gini:39.5, major:false },
  { name:'Algeria', code:'DZ', lat:28.0, lon:1.7, region:'North Africa', pop:'46M', gdp:'$195B', gdppc:'$4,300', hdi:0.745, lifeExp:76.8, literacy:81.4, internet:68.5, co2:3.5, gini:27.6, major:false },
  { name:'Tunisia', code:'TN', lat:33.9, lon:9.5, region:'North Africa', pop:'12M', gdp:'$46B', gdppc:'$3,807', hdi:0.731, lifeExp:76.7, literacy:82.3, internet:71.9, co2:2.5, gini:32.8, major:false },
  { name:'Libya', code:'LY', lat:26.3, lon:17.2, region:'North Africa', pop:'7M', gdp:'$42B', gdppc:'$6,018', hdi:0.718, lifeExp:73.4, literacy:91.0, internet:84.2, co2:7.8, gini:33.0, major:false },

  // Africa — West
  { name:'Nigeria', code:'NG', lat:9.1, lon:8.7, region:'West Africa', pop:'224M', gdp:'$477B', gdppc:'$2,065', hdi:0.548, lifeExp:52.7, literacy:62.0, internet:55.4, co2:0.6, gini:35.1, major:true },
  { name:'Ghana', code:'GH', lat:7.9, lon:-1.0, region:'West Africa', pop:'34M', gdp:'$76B', gdppc:'$2,258', hdi:0.602, lifeExp:64.1, literacy:79.0, internet:68.2, co2:0.6, gini:43.5, major:false },
  { name:'Senegal', code:'SN', lat:14.5, lon:-14.5, region:'West Africa', pop:'18M', gdp:'$28B', gdppc:'$1,595', hdi:0.511, lifeExp:68.6, literacy:51.9, internet:58.0, co2:0.7, gini:40.3, major:false },
  { name:"Côte d'Ivoire", code:'CI', lat:7.5, lon:-5.5, region:'West Africa', pop:'29M', gdp:'$78B', gdppc:'$2,730', hdi:0.550, lifeExp:58.6, literacy:47.2, internet:45.4, co2:0.4, gini:41.5, major:false },

  // Africa — East
  { name:'Kenya', code:'KE', lat:0.0, lon:38.0, region:'East Africa', pop:'56M', gdp:'$113B', gdppc:'$2,099', hdi:0.575, lifeExp:66.7, literacy:81.5, internet:40.0, co2:0.4, gini:40.8, major:true },
  { name:'Ethiopia', code:'ET', lat:9.1, lon:40.5, region:'East Africa', pop:'126M', gdp:'$156B', gdppc:'$1,253', hdi:0.492, lifeExp:67.8, literacy:51.8, internet:25.0, co2:0.2, gini:35.0, major:true },
  { name:'Tanzania', code:'TZ', lat:-6.4, lon:34.9, region:'East Africa', pop:'67M', gdp:'$79B', gdppc:'$1,192', hdi:0.549, lifeExp:66.2, literacy:78.0, internet:32.0, co2:0.2, gini:40.5, major:false },
  { name:'Uganda', code:'UG', lat:1.4, lon:32.3, region:'East Africa', pop:'49M', gdp:'$46B', gdppc:'$964', hdi:0.525, lifeExp:63.4, literacy:76.5, internet:26.0, co2:0.1, gini:42.8, major:false },
  { name:'Rwanda', code:'RW', lat:-1.9, lon:29.9, region:'East Africa', pop:'14M', gdp:'$13B', gdppc:'$966', hdi:0.534, lifeExp:69.0, literacy:73.2, internet:30.0, co2:0.1, gini:43.7, major:false },
  { name:'Madagascar', code:'MG', lat:-18.8, lon:46.9, region:'East Africa', pop:'30M', gdp:'$16B', gdppc:'$530', hdi:0.501, lifeExp:67.0, literacy:76.7, internet:14.5, co2:0.1, gini:42.6, major:false },
  { name:'Somalia', code:'SO', lat:5.2, lon:46.2, region:'East Africa', pop:'18M', gdp:'$8B', gdppc:'$446', hdi:0.381, lifeExp:57.4, literacy:40.0, internet:20.0, co2:0.0, gini:36.8, major:false },

  // Africa — Southern
  { name:'South Africa', code:'ZA', lat:-30.6, lon:22.9, region:'Southern Africa', pop:'62M', gdp:'$399B', gdppc:'$6,485', hdi:0.713, lifeExp:65.3, literacy:95.0, internet:72.3, co2:6.7, gini:63.0, major:true },
  { name:'DR Congo', code:'CD', lat:-4.0, lon:21.8, region:'Central Africa', pop:'102M', gdp:'$66B', gdppc:'$654', hdi:0.479, lifeExp:60.7, literacy:77.0, internet:23.2, co2:0.04, gini:42.1, major:true },
  { name:'Angola', code:'AO', lat:-11.2, lon:17.9, region:'Southern Africa', pop:'36M', gdp:'$74B', gdppc:'$2,045', hdi:0.586, lifeExp:61.6, literacy:72.0, internet:36.0, co2:0.7, gini:51.3, major:false },
  { name:'Mozambique', code:'MZ', lat:-18.7, lon:35.5, region:'Southern Africa', pop:'33M', gdp:'$18B', gdppc:'$542', hdi:0.461, lifeExp:60.9, literacy:63.4, internet:21.0, co2:0.2, gini:54.0, major:false },
  { name:'Zimbabwe', code:'ZW', lat:-19.0, lon:29.2, region:'Southern Africa', pop:'16M', gdp:'$29B', gdppc:'$1,773', hdi:0.550, lifeExp:61.5, literacy:89.7, internet:35.1, co2:0.5, gini:50.3, major:false },
  { name:'Zambia', code:'ZM', lat:-13.1, lon:27.8, region:'Southern Africa', pop:'20M', gdp:'$29B', gdppc:'$1,457', hdi:0.565, lifeExp:63.9, literacy:86.7, internet:27.0, co2:0.3, gini:57.1, major:false },
  { name:'Botswana', code:'BW', lat:-22.3, lon:24.7, region:'Southern Africa', pop:'2.6M', gdp:'$19B', gdppc:'$7,738', hdi:0.693, lifeExp:61.1, literacy:88.5, internet:71.0, co2:2.8, gini:53.3, major:false },

  // Oceania
  { name:'Australia', code:'AU', lat:-25.3, lon:133.8, region:'Oceania', pop:'26M', gdp:'$1.7T', gdppc:'$65,366', hdi:0.946, lifeExp:83.3, literacy:99, internet:96.2, co2:14.9, gini:34.4, major:true },
  { name:'New Zealand', code:'NZ', lat:-40.9, lon:174.9, region:'Oceania', pop:'5.2M', gdp:'$252B', gdppc:'$48,781', hdi:0.939, lifeExp:82.5, literacy:99, internet:95.0, co2:6.2, gini:36.0, major:false },
  { name:'Papua New Guinea', code:'PG', lat:-6.3, lon:143.9, region:'Oceania', pop:'10M', gdp:'$31B', gdppc:'$3,016', hdi:0.558, lifeExp:65.0, literacy:64.2, internet:32.0, co2:0.8, gini:41.9, major:false },
];

// ============================================
// Country Markers — on globe
// ============================================
const pointsGroup = new THREE.Group();
earth.add(pointsGroup);

const countryMeshes = [];
let activeMetric = 'hdi';

countries.forEach((c) => {
  const pos = latLonToVec3(c.lat, c.lon, 1.012);
  const size = c.major ? 0.014 : 0.009;

  // Marker dot colored by HDI
  const geo = new THREE.SphereGeometry(size, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: hdiColor(c.hdi) });
  const marker = new THREE.Mesh(geo, mat);
  marker.position.copy(pos);
  marker.userData = c;
  pointsGroup.add(marker);
  countryMeshes.push(marker);

  // Pulse ring
  const ringGeo = new THREE.RingGeometry(size * 1.2, size * 2.0, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: hdiColor(c.hdi), transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(pos);
  ring.lookAt(pos.clone().multiplyScalar(2));
  ring.userData.phase = Math.random() * Math.PI * 2;
  ring.userData.isRing = true;
  pointsGroup.add(ring);

  // Country label
  const labelDiv = document.createElement('div');
  labelDiv.className = 'country-label' + (c.major ? ' major' : '');
  labelDiv.textContent = c.name;
  const label = new CSS2DObject(labelDiv);
  const labelPos = latLonToVec3(c.lat, c.lon, 1.06);
  label.position.copy(labelPos);
  label.userData.isLabel = true;
  label.userData.countryData = c;
  pointsGroup.add(label);
});

// ============================================
// Country Borders from GeoJSON
// ============================================
const bordersGroup = new THREE.Group();
earth.add(bordersGroup);

async function loadBorders() {
  try {
    const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    const topology = await resp.json();

    // Decode TopoJSON arcs
    const tf = topology.transform;
    const arcs = topology.arcs.map(arc => {
      const coords = [];
      let x = 0, y = 0;
      arc.forEach(([dx, dy]) => {
        x += dx; y += dy;
        coords.push([
          x * tf.scale[0] + tf.translate[0],
          y * tf.scale[1] + tf.translate[1]
        ]);
      });
      return coords;
    });

    function decodeArc(idx) {
      if (idx >= 0) return arcs[idx];
      return [...arcs[~idx]].reverse();
    }

    // Draw each country's borders
    const countries110 = topology.objects.countries;
    const geometries = countries110.geometries;

    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
    });

    geometries.forEach(geom => {
      let rings = [];
      if (geom.type === 'Polygon') {
        rings = geom.arcs;
      } else if (geom.type === 'MultiPolygon') {
        geom.arcs.forEach(poly => { rings.push(...poly); });
      }

      rings.forEach(ring => {
        const coords = [];
        ring.forEach(idx => {
          const decoded = decodeArc(idx);
          decoded.forEach(([lon, lat]) => {
            coords.push(latLonToVec3(lat, lon, 1.003));
          });
        });

        if (coords.length < 2) return;
        const geometry = new THREE.BufferGeometry().setFromPoints(coords);
        const line = new THREE.Line(geometry, borderMaterial);
        bordersGroup.add(line);
      });
    });
  } catch (e) {
    console.warn('Could not load country borders:', e);
  }
}

loadBorders();

// ============================================
// Connection Arcs — development aid / trade
// ============================================
const arcRoutes = [
  // Development aid flows
  { from: 'US', to: 'ET', label: 'Aid' },
  { from: 'GB', to: 'KE', label: 'Aid' },
  { from: 'DE', to: 'IN', label: 'Trade' },
  { from: 'JP', to: 'ID', label: 'FDI' },
  { from: 'CN', to: 'NG', label: 'FDI' },
  { from: 'FR', to: 'SN', label: 'Aid' },
  { from: 'US', to: 'BR', label: 'Trade' },
  { from: 'CN', to: 'ZA', label: 'Trade' },
  { from: 'AU', to: 'PG', label: 'Aid' },
  { from: 'SA', to: 'EG', label: 'FDI' },
  { from: 'KR', to: 'VN', label: 'FDI' },
  { from: 'US', to: 'JP', label: 'Trade' },
  { from: 'DE', to: 'CN', label: 'Trade' },
  { from: 'GB', to: 'AU', label: 'Trade' },
  { from: 'US', to: 'IN', label: 'FDI' },
  { from: 'NO', to: 'TZ', label: 'Aid' },
];

const arcsGroup = new THREE.Group();
earth.add(arcsGroup);

const packets = [];
const packetGeometry = new THREE.SphereGeometry(0.005, 8, 8);
const packetsGroup = new THREE.Group();
earth.add(packetsGroup);

function getCountryByCode(code) {
  return countries.find(c => c.code === code);
}

arcRoutes.forEach(route => {
  const fromC = getCountryByCode(route.from);
  const toC = getCountryByCode(route.to);
  if (!fromC || !toC) return;

  const startPos = latLonToVec3(fromC.lat, fromC.lon, 1.012);
  const endPos = latLonToVec3(toC.lat, toC.lon, 1.012);
  const mid = startPos.clone().add(endPos).multiplyScalar(0.5);
  const dist = startPos.distanceTo(endPos);
  mid.normalize().multiplyScalar(1 + dist * 0.35);

  const curve = new THREE.QuadraticBezierCurve3(startPos, mid, endPos);
  const pts = curve.getPoints(64);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);

  const arcColor = route.label === 'Aid' ? 0x34d399 : route.label === 'FDI' ? 0xa78bfa : 0x38bdf8;
  const mat = new THREE.LineBasicMaterial({ color: arcColor, transparent: true, opacity: 0.2 });
  arcsGroup.add(new THREE.Line(geo, mat));

  // Data packet
  const packetMat = new THREE.MeshBasicMaterial({ color: arcColor, transparent: true, opacity: 0.9 });
  const packet = new THREE.Mesh(packetGeometry, packetMat);
  packet.userData.curve = curve;
  packet.userData.t = Math.random();
  packet.userData.speed = 0.002 + Math.random() * 0.002;
  packetsGroup.add(packet);
  packets.push(packet);
});

// ============================================
// Star Field
// ============================================
const starCount = isMobileDevice ? 1500 : 3000;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 50 + Math.random() * 100;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = r * Math.cos(phi);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.6, sizeAttenuation: true })));

// ============================================
// Raycaster — hover for country detail
// ============================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const globeLabel = document.getElementById('globe-label');
const detailPanel = document.getElementById('country-detail');
const noSelectionHint = document.getElementById('no-selection-hint');

canvas.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(countryMeshes, true);

  if (intersects.length > 0) {
    const c = intersects[0].object.userData;
    globeLabel.innerHTML = `<strong>${c.name}</strong> &middot; HDI ${c.hdi} &middot; GDP/cap ${c.gdppc}`;
    globeLabel.classList.remove('hidden');
    globeLabel.style.left = event.clientX + 16 + 'px';
    globeLabel.style.top = event.clientY - 16 + 'px';
    canvas.style.cursor = 'pointer';
    controls.autoRotate = false;

    // Update detail panel
    updateDetailPanel(c);
  } else {
    globeLabel.classList.add('hidden');
    canvas.style.cursor = 'grab';
    controls.autoRotate = true;
  }
});

function updateDetailPanel(c) {
  detailPanel.style.display = 'block';
  noSelectionHint.style.display = 'none';

  document.getElementById('detail-country-name').textContent = c.name;
  document.getElementById('detail-region').textContent = c.region;
  document.getElementById('detail-pop').textContent = c.pop;
  document.getElementById('detail-gdp').textContent = c.gdp;
  document.getElementById('detail-gdppc').textContent = c.gdppc;
  document.getElementById('detail-hdi').textContent = c.hdi.toFixed(3);
  document.getElementById('detail-hdi').style.color = hdiColorCSS(c.hdi);
  document.getElementById('detail-life').textContent = c.lifeExp + ' years';
  document.getElementById('detail-literacy').textContent = c.literacy + '%';
  document.getElementById('detail-internet').textContent = c.internet + '%';
  document.getElementById('detail-co2').textContent = c.co2 + ' tons';
  document.getElementById('detail-gini').textContent = c.gini.toFixed(1);

  // HDI bar position
  document.getElementById('detail-hdi-bar').style.left = (c.hdi * 100) + '%';
}

// ============================================
// Metric Switching (top nav)
// ============================================
const metricConfig = {
  hdi: { key: 'hdi', label: 'HDI', colorFn: hdiColor },
  gdppc: { key: 'gdppc', label: 'GDP/Capita', colorFn: (v) => { const n = parseInt(String(v).replace(/[$,T]/g, '')); if (n >= 30000) return 0x34d399; if (n >= 10000) return 0x38bdf8; if (n >= 3000) return 0xfbbf24; return 0xf87171; }},
  lifeExp: { key: 'lifeExp', label: 'Life Expectancy', colorFn: (v) => { if (v >= 78) return 0x34d399; if (v >= 72) return 0x38bdf8; if (v >= 65) return 0xfbbf24; return 0xf87171; }},
  literacy: { key: 'literacy', label: 'Literacy', colorFn: (v) => { if (v >= 95) return 0x34d399; if (v >= 80) return 0x38bdf8; if (v >= 60) return 0xfbbf24; return 0xf87171; }},
  internet: { key: 'internet', label: 'Internet', colorFn: (v) => { if (v >= 85) return 0x34d399; if (v >= 60) return 0x38bdf8; if (v >= 35) return 0xfbbf24; return 0xf87171; }},
};

document.querySelectorAll('.nav-link[data-metric]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-link[data-metric]').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const metric = link.dataset.metric;
    activeMetric = metric;
    updateMarkerColors(metric);
  });
});

function updateMarkerColors(metric) {
  const cfg = metricConfig[metric];
  if (!cfg) return;

  countryMeshes.forEach((marker) => {
    const c = marker.userData;
    let val = c[cfg.key];
    if (typeof val === 'string') val = parseInt(val.replace(/[$,TBM]/g, ''));
    const color = cfg.colorFn(val);
    marker.material.color.setHex(color);
  });

  // Update rings too
  pointsGroup.children.forEach(child => {
    if (child.userData.isRing && child.material) {
      // Find corresponding country from nearest marker
      const pos = child.position;
      let closest = null;
      let minDist = Infinity;
      countryMeshes.forEach(m => {
        const d = m.position.distanceTo(pos);
        if (d < minDist) { minDist = d; closest = m; }
      });
      if (closest) {
        child.material.color.copy(closest.material.color);
      }
    }
  });
}

// ============================================
// Mobile Touch Support
// ============================================
const isMobile = window.matchMedia('(max-width: 600px)').matches || 'ontouchstart' in window;
const mobileDrawer = document.getElementById('mobile-drawer');
const mobileDrawerGrid = document.getElementById('m-drawer-grid');
const tapHint = document.getElementById('tap-hint');

// Hide tap hint after first interaction
let tapHintShown = true;
function hideTapHint() {
  if (tapHintShown && tapHint) {
    tapHint.classList.add('hidden');
    tapHintShown = false;
    setTimeout(() => { if (tapHint) tapHint.style.display = 'none'; }, 1000);
  }
}

// Drawer tab switching
document.querySelectorAll('.drawer-tab[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.drawer-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById('m-tab-' + tab.dataset.tab);
    if (target) target.classList.add('active');
  });
});

// Info button opens drawer to SDG/Legend tab (no country needed)
const mobileInfoBtn = document.getElementById('mobile-info-btn');
if (mobileInfoBtn) {
  mobileInfoBtn.addEventListener('click', () => {
    if (!mobileDrawer) return;
    const nameEl = document.getElementById('m-drawer-name');
    const regionEl = document.getElementById('m-drawer-region');
    const hdiEl = document.getElementById('m-drawer-hdi');
    if (nameEl) nameEl.textContent = 'Global Data';
    if (regionEl) regionEl.textContent = 'Development Overview';
    if (hdiEl) hdiEl.textContent = '';
    // Switch to SDG tab
    document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.drawer-tab-content').forEach(c => c.classList.remove('active'));
    const sdgTab = document.querySelector('.drawer-tab[data-tab="sdg"]');
    const sdgContent = document.getElementById('m-tab-sdg');
    if (sdgTab) sdgTab.classList.add('active');
    if (sdgContent) sdgContent.classList.add('active');
    mobileDrawer.classList.add('open');
    hideTapHint();
  });
}

// Mobile drawer open/close
function openMobileDrawer(c) {
  if (!mobileDrawer) return;
  // Switch to stats tab when opening for a country
  document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.drawer-tab-content').forEach(ct => ct.classList.remove('active'));
  const statsTab = document.querySelector('.drawer-tab[data-tab="stats"]');
  const statsContent = document.getElementById('m-tab-stats');
  if (statsTab) statsTab.classList.add('active');
  if (statsContent) statsContent.classList.add('active');

  const nameEl = document.getElementById('m-drawer-name');
  const regionEl = document.getElementById('m-drawer-region');
  const hdiEl = document.getElementById('m-drawer-hdi');
  const hdiBar = document.getElementById('m-drawer-hdi-bar');

  if (nameEl) nameEl.textContent = c.name;
  if (regionEl) regionEl.textContent = c.region;
  if (hdiEl) {
    hdiEl.textContent = c.hdi.toFixed(3);
    hdiEl.style.color = hdiColorCSS(c.hdi);
  }
  if (hdiBar) hdiBar.style.left = (c.hdi * 100) + '%';

  // Build stat grid
  if (mobileDrawerGrid) {
    mobileDrawerGrid.innerHTML = [
      { label: 'Population', value: c.pop },
      { label: 'GDP', value: c.gdp },
      { label: 'GDP/Capita', value: c.gdppc },
      { label: 'Life Expect.', value: c.lifeExp + ' yrs' },
      { label: 'Literacy', value: c.literacy + '%' },
      { label: 'Internet', value: c.internet + '%' },
      { label: 'CO₂/capita', value: c.co2 + ' tons' },
      { label: 'Gini Index', value: c.gini.toFixed(1) },
    ].map(s => `<div class="drawer-stat"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div>`).join('');
  }

  mobileDrawer.classList.add('open');
  hideTapHint();
}

function closeMobileDrawer() {
  if (mobileDrawer) mobileDrawer.classList.remove('open');
}

// Close button
const mDrawerClose = document.getElementById('m-drawer-close');
if (mDrawerClose) mDrawerClose.addEventListener('click', closeMobileDrawer);

// Tap on globe to select country (touch devices)
canvas.addEventListener('touchend', (event) => {
  if (event.changedTouches.length === 0) return;
  const touch = event.changedTouches[0];
  mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(countryMeshes, true);

  if (intersects.length > 0) {
    const c = intersects[0].object.userData;
    if (isMobile || window.innerWidth <= 600) {
      openMobileDrawer(c);
    } else {
      updateDetailPanel(c);
    }
    // Stop auto-rotate briefly
    controls.autoRotate = false;
    setTimeout(() => { controls.autoRotate = true; }, 5000);
  } else {
    closeMobileDrawer();
  }
}, { passive: true });

// Swipe-down to close drawer
let drawerTouchStartY = 0;
if (mobileDrawer) {
  mobileDrawer.addEventListener('touchstart', (e) => {
    drawerTouchStartY = e.touches[0].clientY;
  }, { passive: true });
  mobileDrawer.addEventListener('touchmove', (e) => {
    const dy = e.touches[0].clientY - drawerTouchStartY;
    if (dy > 60) closeMobileDrawer();
  }, { passive: true });
}

// Mobile metric pills
document.querySelectorAll('.m-pill[data-metric]').forEach(pill => {
  pill.addEventListener('click', (e) => {
    document.querySelectorAll('.m-pill[data-metric]').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeMetric = pill.dataset.metric;
    updateMarkerColors(pill.dataset.metric);
  });
});

// Auto-hide tap hint after 5 seconds
if (tapHint) setTimeout(() => hideTapHint(), 8000);

// ============================================
// Mini Chart Drawing
// ============================================
function createMiniChart(containerId, color, data) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const cvs = document.createElement('canvas');
  container.appendChild(cvs);
  const ctx = cvs.getContext('2d');
  const w = container.offsetWidth || 200;
  const h = container.offsetHeight || 36;
  cvs.width = w * 2; cvs.height = h * 2;
  cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
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
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '30');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.fill();
}

function genData(base, variance, len) {
  const d = [base];
  for (let i = 1; i < len; i++) d.push(d[i - 1] + (Math.random() - 0.4) * variance);
  return d;
}

createMiniChart('chart-pop', '#a78bfa', genData(7.0, 0.15, 30));
createMiniChart('chart-gdp', '#34d399', genData(80, 3, 30));
createMiniChart('chart-life', '#38bdf8', genData(70, 0.5, 30));
createMiniChart('chart-poverty', '#f87171', genData(12, -0.3, 30));
createMiniChart('chart-internet', '#fbbf24', genData(50, 2, 30));
createMiniChart('chart-literacy', '#34d399', genData(82, 0.5, 30));

// ============================================
// Clock
// ============================================
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
updateClock();
setInterval(updateClock, 1000);

// ============================================
// Resize
// ============================================
window.addEventListener('resize', () => {
  const nowMobile = window.innerWidth <= 600;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);

  // Adjust camera distance based on viewport
  if (nowMobile && camera.position.z > 2.8) {
    camera.position.set(0, 0.2, 2.6);
  } else if (!nowMobile && camera.position.z < 2.8) {
    camera.position.set(0, 0.4, 3.2);
  }
});

// ============================================
// Label visibility — hide labels on back of globe
// ============================================
function updateLabelVisibility() {
  const cameraDir = camera.position.clone().normalize();

  pointsGroup.children.forEach(child => {
    if (child.userData.isLabel && child.element) {
      const labelWorldPos = new THREE.Vector3();
      child.getWorldPosition(labelWorldPos);
      const dot = labelWorldPos.normalize().dot(cameraDir);
      child.element.style.opacity = dot > 0.15 ? '1' : '0';
    }
  });
}

// ============================================
// Animation Loop
// ============================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Pulse rings
  pointsGroup.children.forEach(child => {
    if (child.userData.isRing && child.material) {
      const phase = child.userData.phase || 0;
      const scale = 1 + Math.sin(elapsed * 2 + phase) * 0.5;
      child.scale.set(scale, scale, scale);
      child.material.opacity = 0.5 - Math.sin(elapsed * 2 + phase) * 0.25;
    }
  });

  // Move data packets
  packets.forEach(packet => {
    packet.userData.t += packet.userData.speed;
    if (packet.userData.t > 1) packet.userData.t = 0;
    const pos = packet.userData.curve.getPoint(packet.userData.t);
    packet.position.copy(pos);
    packet.material.opacity = Math.sin(packet.userData.t * Math.PI) * 0.9;
  });

  updateLabelVisibility();

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();
