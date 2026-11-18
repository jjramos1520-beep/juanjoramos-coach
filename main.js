// Escena 3D de la portada: del cielo al gimnasio, guiada por el scroll.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// En una captura para Figma todo se muestra en su estado final y el texto va sin trocear
const CAP = location.hash.includes('figmacapture');
if (CAP) {
  document.documentElement.classList.add('cap');
  // Figma no puede descargar imágenes de un servidor local: se incrustan como data URL
  document.querySelectorAll('img').forEach(async i => {
    i.loading = 'eager';
    const blob = await (await fetch(i.currentSrc || i.src)).blob();
    const r = new FileReader(); r.onload = () => { i.removeAttribute('srcset'); i.src = r.result; }; r.readAsDataURL(blob);
  });
  document.querySelectorAll('[data-split],[data-hw],[data-words]').forEach(el => { el.removeAttribute('data-split'); el.removeAttribute('data-hw'); el.removeAttribute('data-words'); });
}
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || CAP;
const small = matchMedia('(max-width: 860px)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
const range = (p, a, b) => clamp((p - a) / (b - a));

/* ================= Capa de texto (funciona también sin WebGL) ================= */
const story = document.getElementById('historia');
const stage = story.querySelector('.stage');
const chapters = [...story.querySelectorAll('.ch')].map(el => ({ el, a: +el.dataset.from, b: +el.dataset.to }));
const railLinks = [...story.querySelectorAll('.rail a')];
const railBox = story.querySelector('.rail');
const weekNum = document.getElementById('weekNum');
const weekDots = document.getElementById('weekDots');
for (let i = 0; i < 12; i++) weekDots.appendChild(document.createElement('span'));
const weekCh = chapters.find(c => c.el.dataset.weeks);
const [wA, wB] = weekCh.el.dataset.weeks.split(',').map(Number);

document.querySelectorAll('[data-split]').forEach(el => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(' ');
});
// El titular de la portada entra una vez al cargar.
chapters[0].el.classList.remove('is-on');
requestAnimationFrame(() => requestAnimationFrame(() => chapters[0].el.classList.add('is-on')));

let pTarget = 0;
const readScroll = () => {
  const total = story.offsetHeight * (6.2 / 7.2);
  pTarget = total > 0 ? clamp(-story.getBoundingClientRect().top / total) : 0;
};
let lastActive = 0, lastWeek = -1;
function updateText(p) {
  let active = -1;
  chapters.forEach((c, i) => { if (p >= c.a && p < c.b) active = i; });
  if (active !== lastActive) {
    chapters.forEach((c, i) => c.el.classList.toggle('is-on', i === active));
    lastActive = active;
  }
  let near = 0;
  chapters.forEach((c, i) => { if (p >= c.a - 0.02) near = i; });
  railLinks.forEach((a, i) => a.classList.toggle('on', i === near));
  railBox.style.setProperty('--p', p.toFixed(4));
  stage.classList.toggle('past-start', p > 0.02);
  const w = clamp(Math.ceil(range(p, wA, wB) * 12), 1, 12);
  if (w !== lastWeek) {
    weekNum.textContent = String(w).padStart(2, '0');
    [...weekDots.children].forEach((d, i) => d.classList.toggle('on', i < w));
    lastWeek = w;
  }
  return w;
}

/* ================= Resto de la página ================= */
// Declaración: cada palabra se enciende al cruzar el centro de la pantalla.
const words = [];
document.querySelectorAll('[data-words]').forEach(el => {
  const parts = [];
  el.childNodes.forEach(n => {
    const hl = n.nodeName === 'EM';
    n.textContent.split(/(\s+)/).forEach(t => {
      if (!t) return;
      parts.push(/^\s+$/.test(t) ? t : `<span class="sw${hl ? ' hl' : ''}">${t}</span>`);
    });
  });
  el.innerHTML = parts.join('');
  words.push(...el.querySelectorAll('.sw'));
});
function updateWords() {
  const line = innerHeight * 0.62;
  for (const w of words) w.classList.toggle('lit', w.getBoundingClientRect().top < line);
}
// Animaciones ligadas al scroll: cada [data-scrub] recibe --s de 0 (su borde superior en data-start × pantalla)
// a 1 (en data-end × pantalla); el CSS decide qué se mueve con ese valor.
document.querySelectorAll('[data-hw]').forEach(el => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w, i) => `<span class="hw"><span style="--i:${i}">${w}</span></span>`).join(' ');
});
document.querySelectorAll('.faq > div').forEach((d, i) => d.style.setProperty('--i', i));
const scrubs = [...document.querySelectorAll('[data-scrub]')].map(el => ({ el, a: +(el.dataset.start || 1), b: +(el.dataset.end || 0.35), last: -1 }));
let scrubQueued = false;
function updateScrubs() {
  scrubQueued = false;
  const vh = innerHeight;
  if (!vh) return; // panel oculto: sin altura no hay nada que calcular
  for (const sc of scrubs) {
    const top = sc.el.getBoundingClientRect().top;
    const v = reduce ? 1 : Math.round(clamp((sc.a * vh - top) / ((sc.a - sc.b) * vh)) * 1000) / 1000;
    if (v !== sc.last) { sc.el.style.setProperty('--s', v); sc.last = v; }
  }
}
const queueScrubs = () => { if (!scrubQueued) { scrubQueued = true; requestAnimationFrame(updateScrubs); } };
addEventListener('scroll', queueScrubs, { passive: true });
addEventListener('resize', queueScrubs);
updateScrubs();
document.querySelectorAll('.card').forEach(c => c.addEventListener('pointermove', e => {
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', `${e.clientX - r.left}px`);
  c.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

addEventListener('scroll', () => { readScroll(); updateWords(); }, { passive: true });
addEventListener('resize', readScroll);
readScroll(); updateWords();

/* ================= Escena ================= */
let renderer;
try {
  // Para capturas (Figma) el lienzo debe conservar su imagen entre fotogramas
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: location.hash.includes('figmacapture') });
} catch (e) {
  renderer = null;
}
if (!renderer) {
  // Sin WebGL: el texto sigue al scroll sobre el fondo de la escena.
  const tick = () => { updateText(pTarget); requestAnimationFrame(tick); };
  tick();
} else {
  // Las iniciales y el texto del disco se dibujan con Geist: esperar a que cargue (como mucho 1,5 s).
  Promise.race([
    Promise.all([document.fonts.load('600 270px Geist'), document.fonts.load('500 44px "Geist Mono"')]),
    new Promise(r => setTimeout(r, 1500)),
  ]).catch(() => {}).then(() => buildScene(renderer));
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function buildScene(renderer) {
  const DPR_MAX = Math.min(devicePixelRatio, small ? 1 : 1.25), DPR_MIN = small ? 0.55 : 0.65;
  let dpr = Math.min(DPR_MAX, 1);
  const DPR = DPR_MAX; // tamaño de partículas calculado para la resolución máxima
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  const FOG = new THREE.Color('#060a18');
  scene.fog = new THREE.FogExp2(FOG, 0.0016);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 1500);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  /* ---------- Materiales ---------- */
  const M = {
    chrome: new THREE.MeshStandardMaterial({ color: '#8f98a6', metalness: 1, roughness: 0.28 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#0d1324', metalness: 0.3, roughness: 0.34 }),
    // Cristal oscuro casi sin reflejo del entorno: si no, los paneles de luz del entorno se ven como cuadrados en las paredes
    glass: new THREE.MeshStandardMaterial({ color: '#0a1430', metalness: 0.5, roughness: 0.4, envMapIntensity: 0 }),
    wall: new THREE.MeshStandardMaterial({ color: '#0a1022', metalness: 0.6, roughness: 0.38 }),
    dark: new THREE.MeshStandardMaterial({ color: '#111a30', metalness: 0.55, roughness: 0.4 }),
    blue: new THREE.MeshBasicMaterial({ color: new THREE.Color('#4d7dff').multiplyScalar(2.2), toneMapped: false }),
    mint: new THREE.MeshBasicMaterial({ color: new THREE.Color('#3cf2b4').multiplyScalar(2.2), toneMapped: false }),
    white: new THREE.MeshBasicMaterial({ color: new THREE.Color('#dfe8ff').multiplyScalar(2.6), toneMapped: false }),
  };

  /* ---------- Cielo ---------- */
  const sunDir = new THREE.Vector3(0, 0.06, -1).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: sunDir } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 sunDir;
      void main(){
        float h = vD.y;
        vec3 horizon = vec3(.42,.72,1.5), mid = vec3(.07,.16,.55), top = vec3(.012,.02,.07);
        vec3 c = mix(horizon, mid, smoothstep(-.02, .28, h));
        c = mix(c, top, smoothstep(.2, .85, h));
        c = mix(c, vec3(.02,.03,.07), smoothstep(.0, -.12, h));
        float s = max(dot(vD, sunDir), 0.);
        c += vec3(.55,.98,.86) * (pow(s, 500.) * 6. + pow(s, 40.) * .8 + pow(s, 6.) * .22);
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  scene.add(sky);

  /* ---------- Nubes ---------- */
  const puff = seed => canvasTexture(256, 256, (g, w, h) => {
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 42; i++) {
      const x = w / 2 + (rnd() - 0.5) * w * 0.55, y = h / 2 + (rnd() - 0.5) * h * 0.32, r = 26 + rnd() * 58;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
  const puffs = [puff(7), puff(91), puff(433)];
  const clouds = new THREE.Group();
  const nClouds = small ? 18 : 28;
  for (let i = 0; i < nClouds; i++) {
    const m = new THREE.SpriteMaterial({ map: puffs[i % 3], color: new THREE.Color().setHSL(0.62, 0.55, 0.26 + Math.random() * 0.16), transparent: true, opacity: 0.32 + Math.random() * 0.3, depthWrite: false, rotation: Math.random() * 6.28 });
    const sp = new THREE.Sprite(m);
    const a = Math.random() * Math.PI * 2, r = 25 + Math.pow(Math.random(), 0.7) * 520;
    sp.position.set(Math.cos(a) * r, 40 + Math.random() * 18, Math.sin(a) * r - 120);
    const s = (small ? 110 : 150) + Math.random() * 150; sp.scale.set(s, s * 0.3, 1);
    clouds.add(sp);
  }
  scene.add(clouds);

  /* ---------- Ciudad ---------- */
  let seed = 20261118;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tmp = new THREE.Object3D();
  const city = new THREE.Group(); scene.add(city); // se oculta al entrar en el gimnasio
  // Gimnasio casi cuadrado (34 × 34 m) en el centro de una manzana
  const W = 34, Z0 = 13, Z1 = -21, H = 9, L = Z0 - Z1, ZC = (Z0 + Z1) / 2;
  // Calles cada 48 m: en x = 24 + 48k y z = 20 + 48k, así la manzana central es la del gimnasio
  const BLK = 48, PX = 1024 / BLK, ROAD = 3.4 * PX, WALK = 3 * PX, LAMP_T = [12, 24, 36];
  const groundTex = canvasTexture(1024, 1024, (g, w) => {
    g.fillStyle = '#0c0e13'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 26000; i++) { const v = 12 + rnd() * 14 | 0; g.fillStyle = `rgb(${v},${v + 1},${v + 3})`; g.fillRect(rnd() * w, rnd() * w, 2, 2); }
    g.fillStyle = '#1d2027'; g.fillRect(ROAD, ROAD, w - 2 * ROAD, w - 2 * ROAD);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1;
    for (let k = ROAD; k < w - ROAD; k += PX * 1.2) { g.beginPath(); g.moveTo(k, ROAD); g.lineTo(k, w - ROAD); g.stroke(); g.beginPath(); g.moveTo(ROAD, k); g.lineTo(w - ROAD, k); g.stroke(); }
    g.fillStyle = '#111419'; g.fillRect(ROAD + WALK, ROAD + WALK, w - 2 * (ROAD + WALK), w - 2 * (ROAD + WALK));
    g.strokeStyle = '#3d424d'; g.lineWidth = 3; g.strokeRect(ROAD, ROAD, w - 2 * ROAD, w - 2 * ROAD);
    for (let r = 0; r < 4; r++) {
      g.save(); g.translate(w / 2, w / 2); g.rotate(r * Math.PI / 2); g.translate(-w / 2, -w / 2);
      g.fillStyle = 'rgba(230,215,170,.5)';
      for (let x = ROAD + WALK; x < w - ROAD - WALK; x += PX * 6) g.fillRect(x, -3, PX * 3, 6);
      g.fillStyle = 'rgba(235,235,235,.45)';
      for (const x0 of [ROAD + 4, w - ROAD - 4 - PX * 3]) for (let y = 6; y < ROAD - 4; y += PX * 0.9) g.fillRect(x0, y, PX * 3, PX * 0.45);
      g.globalCompositeOperation = 'lighter';
      for (const t of LAMP_T) { const x = t * PX, y = ROAD + WALK / 2, gr = g.createRadialGradient(x, y, 0, x, y, PX * 6); gr.addColorStop(0, 'rgba(255,185,120,.2)'); gr.addColorStop(1, 'rgba(255,185,120,0)'); g.fillStyle = gr; g.fillRect(x - PX * 6, y - PX * 6, PX * 12, PX * 12); }
      g.globalCompositeOperation = 'source-over';
      g.restore();
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(34, 34); groundTex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(BLK * 34, BLK * 34), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.82, metalness: 0.05 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(24, -0.02, 20);
  city.add(ground);

  // Edificios: tres alturas, cada una con su textura de ventanas (pocas encendidas)
  const winTex = (rows, cols) => canvasTexture(512, 512, (g, w) => {
    g.fillStyle = '#0e1219'; g.fillRect(0, 0, w, w);
    const cw = w / cols, ch = w / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = rnd();
      g.fillStyle = v < 0.13 ? '#ffd29a' : v < 0.17 ? '#bcd3ff' : v < 0.22 ? '#4a5568' : '#161c27';
      g.fillRect(c * cw + cw * 0.14, r * ch + ch * 0.2, cw * 0.72, ch * 0.6);
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let r = 0; r < rows; r++) g.fillRect(0, r * ch, w, ch * 0.08);
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#0d1016', roughness: 0.9 });
  const classes = [[4, 6], [10, 8], [22, 10]].map(([floors, cols]) => {
    const t = winTex(floors, cols);
    const side = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.85, roughness: 0.6, metalness: 0.3 });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [side, side, roofMat, roofMat, side, side], 1300);
    mesh.count = 0; city.add(mesh);
    return { mesh, h: floors * 3.4 };
  });
  const R = 8;
  for (let bx = -R; bx <= R; bx++) for (let bz = -R; bz <= R; bz++) {
    if (bx === 0 && (bz === 0 || bz === 1)) continue; // gimnasio y la plaza de enfrente
    const cx = bx * BLK, cz = ZC + bz * BLK, d = Math.hypot(bx, bz);
    for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
      if (rnd() < 0.15) continue;
      const v = rnd(), cl = classes[d < 2 ? (v < 0.75 ? 0 : 1) : v < 0.4 ? 0 : v < 0.75 ? 1 : 2];
      const w = 11 + rnd() * 5, dd = 11 + rnd() * 5;
      tmp.position.set(cx + qx * 8.8, 0, cz + qz * 8.8); tmp.rotation.set(0, 0, 0); tmp.scale.set(w, cl.h, dd); tmp.updateMatrix();
      cl.mesh.setMatrixAt(cl.mesh.count++, tmp.matrix);
    }
  }

  // Farolas alrededor del gimnasio
  const poleGeo = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.1, 6.5, 10).translate(0, 3.25, 0), new THREE.BoxGeometry(1.2, 0.06, 0.06).translate(0.6, 6.4, 0)]);
  const lampGeo = new THREE.BoxGeometry(0.55, 0.1, 0.24).translate(1.1, 6.32, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc38a').multiplyScalar(2.4), toneMapped: false });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#1a1d23', metalness: 0.7, roughness: 0.4 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 120), lamps = new THREE.InstancedMesh(lampGeo, lampMat, 120);
  let np = 0;
  const off = 24 - (3.4 + 1.5);
  for (let bx = -1; bx <= 1; bx++) for (let bz = -1; bz <= 1; bz++) {
    const cx = bx * BLK, cz = ZC + bz * BLK;
    for (const t of LAMP_T) for (const [x, z, ry] of [[cx - 24 + t, cz + off, -Math.PI / 2], [cx - 24 + t, cz - off, Math.PI / 2], [cx - off, cz - 24 + t, Math.PI], [cx + off, cz - 24 + t, 0]]) {
      if (Math.abs(x) < 4 && z > 10 && z < 35) continue; // deja libre la entrada
      tmp.position.set(x, 0, z); tmp.rotation.set(0, ry, 0); tmp.scale.setScalar(1); tmp.updateMatrix();
      poles.setMatrixAt(np, tmp.matrix); lamps.setMatrixAt(np++, tmp.matrix);
    }
  }
  poles.count = lamps.count = np; city.add(poles, lamps);

  // Árboles en la plaza de enfrente
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 2.6, 8).translate(0, 1.3, 0), new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.9 }), 26);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 1).translate(0, 3.6, 0), new THREE.MeshStandardMaterial({ color: '#16301f', roughness: 0.85, flatShading: true }), 26);
  for (let i = 0; i < 26; i++) {
    const s = i % 2 ? 1 : -1;
    tmp.position.set(s * (6 + rnd() * 11), 0, 28 + rnd() * 32); tmp.rotation.set(0, rnd() * 6, 0); tmp.scale.setScalar(0.8 + rnd() * 0.5); tmp.updateMatrix();
    trunks.setMatrixAt(i, tmp.matrix); crowns.setMatrixAt(i, tmp.matrix);
  }
  city.add(trunks, crowns);

  /* ---------- Materiales del gimnasio ---------- */
  const tiled = (w, h, draw) => { const t = canvasTexture(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  // Caja con UV en metros (÷ s): las texturas no se estiran en las paredes largas
  const BoxUV = (w, h, d, s = 3) => {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let i = 0; i < uv.count; i++) { const f = i >> 2; uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s); }
    return g;
  };
  const concrete = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, map: tiled(512, 512, (g, w) => {
    g.fillStyle = '#2a2d33'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 9000; i++) { const v = 34 + rnd() * 20 | 0; g.fillStyle = `rgba(${v},${v + 2},${v + 6},.5)`; g.fillRect(rnd() * w, rnd() * w, 3, 3); }
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; g.strokeRect(0, 0, w, w);
    g.fillStyle = 'rgba(0,0,0,.35)'; for (const x of [0.2, 0.8]) for (const y of [0.2, 0.8]) { g.beginPath(); g.arc(x * w, y * w, 5, 0, 7); g.fill(); }
  }) });
  const rubberFloor = tiled(256, 256, (g, w) => {
    g.fillStyle = '#17191d'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 2500; i++) { const v = rnd(); g.fillStyle = v < 0.08 ? '#3a4a5c' : v < 0.12 ? '#2b5f4e' : '#22252b'; g.fillRect(rnd() * w, rnd() * w, 2, 2); }
    g.strokeStyle = '#0b0c0e'; g.lineWidth = 2; g.strokeRect(0, 0, w, w);
  });
  rubberFloor.repeat.set(W, L);
  const woodTex = tiled(512, 512, (g, w) => {
    for (let k = 0; k < 8; k++) { const v = 0.8 + rnd() * 0.25; g.fillStyle = `rgb(${150 * v | 0},${108 * v | 0},${70 * v | 0})`; g.fillRect(0, k * 64, w, 64); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(60,35,15,.18)'; g.fillRect(rnd() * w, k * 64 + rnd() * 64, 40 + rnd() * 120, 1.5); } g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, k * 64, w, 2); }
  });
  const turfTex = tiled(512, 512, (g, w) => {
    g.fillStyle = '#1d5a3c'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 20000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? 'rgba(20,70,45,.6)' : 'rgba(45,120,80,.35)'; g.fillRect(rnd() * w, rnd() * w, 1, 3); }
    g.fillStyle = 'rgba(235,240,235,.85)'; g.fillRect(0, 0, w, 6); g.fillRect(0, w - 6, w, 6);
  });
  turfTex.repeat.set(1, 3);
  const MAT = {
    floor: new THREE.MeshStandardMaterial({ map: rubberFloor, roughness: 0.75, metalness: 0.05 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 }),
    turf: new THREE.MeshStandardMaterial({ map: turfTex, roughness: 1 }),
    frame: new THREE.MeshStandardMaterial({ color: '#23272e', metalness: 0.7, roughness: 0.38 }),
    pad: new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.55 }),
    paint: new THREE.MeshStandardMaterial({ color: '#1c9c72', metalness: 0.2, roughness: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#151619', metalness: 0.1, roughness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: '#e6e9ee', roughness: 0.35 }),
    screen: new THREE.MeshBasicMaterial({ color: new THREE.Color('#5d8cff').multiplyScalar(1.4), toneMapped: false }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color('#eef3ff').multiplyScalar(2.2), toneMapped: false }),
    clear: new THREE.MeshStandardMaterial({ color: '#a8c0e0', metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
    mirror: new THREE.MeshStandardMaterial({ color: '#cfd6e0', metalness: 1, roughness: 0.04, envMapIntensity: 1.3 }),
  };
  const textPlane = (w, h, cw, ch, draw, mat = THREE.MeshBasicMaterial, opts = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new mat({ transparent: true, map: canvasTexture(cw, ch, draw), ...opts }));

  /* ---------- El gimnasio ---------- */
  const gym = new THREE.Group(); scene.add(gym);
  const box = (w, h, d, mat, x, y, z, s) => { const m = new THREE.Mesh(BoxUV(w, h, d, s), mat); m.position.set(x, y, z); gym.add(m); return m; };
  // Paredes, cubierta y climatizadores en el tejado
  box(0.5, H, L, concrete, -W / 2, H / 2, ZC);
  box(0.5, H, L, concrete, W / 2, H / 2, ZC);
  box(W, H, 0.5, concrete, 0, H / 2, Z1);
  box(W + 0.6, 0.6, L + 0.6, roofMat, 0, H + 0.3, ZC);
  for (const [x, z, w, d] of [[-9, -10, 3, 2], [-5, -10, 3, 2], [10, 0, 2.2, 4], [8, -14, 4, 4]]) { box(w, 1.4, d, MAT.frame, x, H + 1.3, z); box(w * 0.6, 0.05, d * 0.6, MAT.rubber, x, H + 2.03, z); }
  // Fachada: pilastras, banda superior, escaparates de cristal y puerta doble centrada
  const DW = 2.2, DH = 4.2, GT = 5.5;
  for (const s of [-1, 1]) {
    box(2, H, 0.6, concrete, s * 16, H / 2, Z0);
    box(12, 0.4, 0.6, concrete, s * 9, 0.2, Z0);
    box(0.8, GT, 0.6, concrete, s * 2.6, GT / 2, Z0);
    box(12, GT - 0.4, 0.04, MAT.clear, s * 9, 0.4 + (GT - 0.4) / 2, Z0);
    for (let x = 3; x <= 15; x += 3) box(0.09, GT - 0.4, 0.14, MAT.frame, s * x, 0.4 + (GT - 0.4) / 2, Z0);
    box(12, 0.08, 0.14, MAT.frame, s * 9, GT - 0.04, Z0);
  }
  box(W, H - GT, 0.6, concrete, 0, GT + (H - GT) / 2, Z0);
  box(DW * 2, GT - DH, 0.6, concrete, 0, DH + (GT - DH) / 2, Z0);
  // Rótulo luminoso sobre una placa oscura
  box(17, 2.9, 0.12, MAT.frame, 0, 7.25, Z0 + 0.36);
  const sign = textPlane(16, 2.6, 2048, 420, (g, w) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.font = '600 200px Geist, ui-sans-serif, sans-serif'; g.letterSpacing = '24px'; g.fillText('JUANJO RAMOS', w / 2, 160);
    g.fillStyle = '#3cf2b4'; g.font = '500 76px "Geist Mono", ui-monospace, monospace'; g.letterSpacing = '40px'; g.fillText('TRAINING CLUB', w / 2, 340);
  }, THREE.MeshBasicMaterial, { toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.7) });
  sign.position.set(0, 7.25, Z0 + 0.43); gym.add(sign);
  // Banderola vertical en la esquina
  box(0.24, 5, 1.5, MAT.frame, 15.6, 5.4, Z0 + 1.05);
  for (const s of [-1, 1]) {
    const b = textPlane(1.3, 4.6, 256, 900, (g, w, h) => {
      g.fillStyle = '#3cf2b4'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
      g.fillStyle = '#fff'; g.font = '700 220px Geist, ui-sans-serif, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      ['G', 'Y', 'M'].forEach((c, i) => g.fillText(c, w / 2, 170 + i * 280));
    }, THREE.MeshBasicMaterial, { toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.6) });
    b.rotation.y = s * Math.PI / 2; b.position.set(15.6 + s * 0.13, 5.4, Z0 + 1.05); gym.add(b);
  }
  // Marquesina con tira de luz, escalón y luz de entrada
  box(7.5, 0.28, 2.6, MAT.frame, 0, 4.75, Z0 + 1.3);
  box(6.8, 0.03, 0.12, MAT.led, 0, 4.6, Z0 + 2.4);
  box(DW * 2 + 3, 0.1, 2.6, concrete, 0, 0.05, Z0 + 1.6, 1.5);
  // Mancuerna gigante sobre el tejado: se ve desde el cielo
  const dumb = new THREE.Group(); dumb.position.set(0, H + 3, Z0 - 2.5); gym.add(dumb);
  const dPart = (geo, mat, x, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); dumb.add(m); };
  dPart(new THREE.CylinderGeometry(0.2, 0.2, 10, 32).rotateZ(Math.PI / 2), M.chrome, 0);
  for (const s of [-1, 1]) {
    dPart(new THREE.CylinderGeometry(2, 2, 0.55, 64).rotateZ(Math.PI / 2), MAT.rubber, s * 3.6);
    dPart(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 64).rotateZ(Math.PI / 2), MAT.rubber, s * 4.2);
    dPart(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 32).rotateZ(Math.PI / 2), M.chrome, s * 4.7);
    dPart(new THREE.TorusGeometry(2, 0.05, 8, 128).rotateY(Math.PI / 2), M.mint, s * 3.88);
    dPart(new THREE.BoxGeometry(0.35, 3, 0.35), MAT.frame, s * 2.2, -1.5);
  }
  // Hojas de cristal: cada una gira sobre su bisagra exterior hacia dentro
  const doors = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * DW, 0, Z0); gym.add(pivot);
    const leaf = (w, h, d, mat, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(-s * x, y, 0); pivot.add(m); };
    leaf(DW - 0.08, DH - 0.1, 0.04, MAT.clear, DW / 2, DH / 2);
    leaf(0.08, DH, 0.08, MAT.frame, 0.04, DH / 2); leaf(0.08, DH, 0.08, MAT.frame, DW - 0.04, DH / 2);
    leaf(DW, 0.08, 0.08, MAT.frame, DW / 2, 0.04); leaf(DW, 0.1, 0.08, MAT.frame, DW / 2, DH - 0.05);
    leaf(0.04, 1.4, 0.04, M.chrome, DW - 0.3, 1.2);
    return { pivot, s };
  });

  // Interior: suelo de caucho, vinilo en la pared izquierda y espejo en la derecha
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.5, L - 0.5), MAT.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, ZC); gym.add(floor);
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(6, 13), MAT.turf);
  turf.rotation.x = -Math.PI / 2; turf.position.set(-12.5, 0.02, -14); gym.add(turf);
  const mural = textPlane(15, 3.4, 2048, 460, (g, w) => {
    g.fillStyle = '#e8ecf2'; g.font = '600 250px Geist, ui-sans-serif, sans-serif'; g.textBaseline = 'middle'; g.letterSpacing = '10px'; g.fillText('ARQO METHOD', 10, 190);
    g.fillStyle = '#3cf2b4'; g.font = '500 70px "Geist Mono", ui-monospace, monospace'; g.letterSpacing = '22px'; g.fillText('FUERZA · CONSTANCIA · RESULTADOS', 18, 395);
  }, THREE.MeshStandardMaterial, { roughness: 0.8, color: '#8a9099' });
  mural.rotation.y = Math.PI / 2; mural.position.set(-W / 2 + 0.27, 5.6, -1); gym.add(mural);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.3), MAT.mirror);
  mirror.rotation.y = -Math.PI / 2; mirror.position.set(W / 2 - 0.27, 1.75, -1.5); gym.add(mirror);
  box(0.06, 0.06, 13.1, MAT.frame, W / 2 - 0.28, 2.92, -1.5);

  /* Máquinas. Todas las piezas se funden en una malla por material (pocas llamadas de dibujo). */
  const parts = new Map();
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const C = (r, h, seg = 16) => new THREE.CylinderGeometry(r, r, h, seg);
  // Cada estación se dibuja en coordenadas locales (+z = frente) y se coloca en (ox, oz) girada ry
  const station = (ox, oz, ry = 0) => (geo, mat, x, y, z) => {
    geo.translate(x, y, z).rotateY(ry).translate(ox, 0, oz);
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(geo);
  };
  const { frame, pad, paint, rubber, wood, white, screen } = MAT, chrome = M.chrome;
  const barbell = (P, y, z, len = 2.2, n = 2) => {
    P(C(0.014, len - 0.9).rotateZ(Math.PI / 2), chrome, 0, y, z);
    for (const s of [-1, 1]) {
      P(C(0.025, 0.45).rotateZ(Math.PI / 2), chrome, s * (len / 2 - 0.225), y, z);
      P(C(0.04, 0.03).rotateZ(Math.PI / 2), chrome, s * (len / 2 - 0.46), y, z);
      for (let k = 0; k < n; k++) P(C([0.225, 0.225, 0.2, 0.16][k], 0.055, 40).rotateZ(Math.PI / 2), rubber, s * (len / 2 - 0.41 + k * 0.06), y, z);
    }
  };
  const dumbbell = (P, x, y, z, s) => {
    const hl = 0.05 + 0.04 * s, r = 0.05 + 0.035 * s;
    P(C(0.016, 0.12 + hl).rotateX(Math.PI / 2), chrome, x, y + r, z);
    for (const k of [-1, 1]) P(C(r, hl, 6).rotateX(Math.PI / 2), rubber, x, y + r, z + k * (0.06 + hl / 2));
  };
  const dbRack = (P, len) => {
    for (const x of [-len / 2, 0, len / 2]) { P(B(0.07, 1.0, 0.07), frame, x, 0.5, -0.22); P(B(0.07, 0.68, 0.07), frame, x, 0.34, 0.22); P(B(0.07, 0.07, 0.7), frame, x, 0.03, 0); }
    [[0.62, 0.12], [0.98, -0.12]].forEach(([y, z], tier) => {
      P(B(len, 0.04, 0.42), frame, 0, y, z);
      const n = Math.floor(len / 0.4);
      for (let k = 0; k < n; k++) dumbbell(P, -len / 2 + 0.2 + k * 0.4, y + 0.02, z, tier ? (k / n) * 0.7 : 0.5 + (k / n) * 0.9);
    });
  };
  const bench = (P, z = 0, len = 1.2) => {
    P(B(0.3, 0.09, len), pad, 0, 0.46, z); P(B(0.22, 0.06, len - 0.1), frame, 0, 0.39, z);
    for (const dz of [-1, 1]) { P(B(0.07, 0.38, 0.07), frame, 0, 0.19, z + dz * (len / 2 - 0.15)); P(B(0.5, 0.05, 0.08), frame, 0, 0.025, z + dz * (len / 2 - 0.15)); }
  };
  const adjBench = P => {
    P(B(0.3, 0.09, 0.5), pad, 0, 0.46, 0.3); P(B(0.3, 0.09, 0.85).translate(0, 0, -0.42).rotateX(0.6), pad, 0, 0.5, 0.05);
    P(B(0.08, 0.06, 1.4), frame, 0, 0.12, 0); P(B(0.06, 0.38, 0.06), frame, 0, 0.3, 0.3);
    for (const z of [0.6, -0.65]) P(B(0.5, 0.05, 0.08), frame, 0, 0.025, z);
  };
  const powerRack = (P, n = 2) => {
    P(B(3, 0.06, 2.6), wood, 0, 0.03, 0.3);
    for (const x of [-0.62, 0.62]) for (const z of [-0.55, 0.55]) P(B(0.075, 2.35, 0.075), frame, x, 1.2, z);
    for (const z of [-0.55, 0.55]) P(B(1.32, 0.075, 0.075), frame, 0, 2.38, z);
    for (const x of [-0.62, 0.62]) { P(B(0.075, 0.075, 1.18), frame, x, 2.38, 0); P(B(0.075, 0.075, 1.18), frame, x, 0.1, 0); P(B(0.05, 0.05, 0.7), chrome, x, 0.8, 0.5); P(B(0.09, 0.1, 0.12), paint, x, 1.4, 0.62); }
    P(C(0.019, 1.3).rotateZ(Math.PI / 2), chrome, 0, 2.25, 0.62);
    barbell(P, 1.48, 0.66, 2.2, n);
    for (const s of [-1, 1]) { P(C(0.03, 0.3).rotateZ(Math.PI / 2), chrome, s * 0.8, 0.26, -0.55); for (let k = 0; k < 3; k++) P(C(0.225, 0.05, 40).rotateZ(Math.PI / 2), rubber, s * (0.72 + k * 0.055), 0.26, -0.55); }
  };
  const smith = P => {
    P(B(2.2, 0.08, 1.6), frame, 0, 0.04, 0);
    for (const x of [-1.05, 1.05]) for (const z of [-0.7, 0.7]) P(B(0.09, 2.3, 0.09), frame, x, 1.15, z);
    for (const z of [-0.7, 0.7]) P(B(2.2, 0.09, 0.09), frame, 0, 2.3, z);
    for (const x of [-1.05, 1.05]) { P(B(0.09, 0.09, 1.5), frame, x, 2.3, 0); P(C(0.025, 2.2), chrome, x * 0.88, 1.15, 0.1); P(B(0.12, 0.16, 0.1), paint, x * 0.88, 1.2, 0.1); }
    P(C(0.022, 2.1).rotateZ(Math.PI / 2), chrome, 0, 1.2, 0.1);
    for (const s of [-1, 1]) P(C(0.2, 0.05, 40).rotateZ(Math.PI / 2), rubber, s * 0.72, 1.2, 0.1);
    bench(P, 0.1);
  };
  const legPress = P => {
    P(B(1.1, 0.12, 2.8), frame, 0, 0.06, 0);
    P(B(0.6, 0.12, 0.55), pad, 0, 0.55, 0.85); P(B(0.12, 0.5, 0.12), frame, 0, 0.3, 0.85);
    P(B(0.6, 0.8, 0.12).translate(0, 0.4, 0).rotateX(-0.5), pad, 0, 0.6, 1.15);
    for (const x of [-0.4, 0.4]) P(B(0.08, 0.08, 2.4).rotateX(Math.PI / 4), frame, x, 1.18, -0.28);
    P(B(0.9, 0.16, 0.5).rotateX(Math.PI / 4), paint, 0, 1.25, -0.35);
    P(B(0.8, 0.9, 0.05).rotateX(Math.PI / 4), frame, 0, 1.0, -0.1);
    for (const s of [-1, 1]) { P(C(0.03, 0.35).rotateZ(Math.PI / 2), chrome, s * 0.62, 1.3, -0.4); for (let k = 0; k < 2; k++) P(C(0.225, 0.05, 40).rotateZ(Math.PI / 2), rubber, s * (0.58 + k * 0.06), 1.3, -0.4); }
    for (const x of [-0.45, 0.45]) P(B(0.1, 2.0, 0.1), frame, x, 1.0, -1.25);
  };
  const stack = (P, x, z) => {
    P(B(0.42, 1.0, 0.26), rubber, x, 0.6, z);
    for (let i = 0; i < 10; i++) P(B(0.44, 0.012, 0.28), chrome, x, 0.14 + i * 0.1, z);
    for (const dx of [-0.24, 0.24]) P(C(0.02, 2.1), chrome, x + dx, 1.1, z);
  };
  const latPulldown = P => {
    P(B(0.9, 0.08, 1.5), frame, 0, 0.04, 0);
    P(B(0.14, 2.5, 0.14), frame, 0, 1.25, -0.65); P(B(0.03, 2.3, 0.03), paint, 0.08, 1.25, -0.58);
    P(B(0.14, 0.14, 1.1), frame, 0, 2.45, -0.15);
    stack(P, 0, -0.42);
    P(C(0.07, 0.04, 20).rotateZ(Math.PI / 2), chrome, 0, 2.35, 0.38);
    P(C(0.006, 0.6), chrome, 0, 2.02, 0.38);
    P(C(0.016, 1.2).rotateZ(Math.PI / 2), chrome, 0, 1.72, 0.38);
    P(B(0.45, 0.1, 0.42), pad, 0, 0.5, 0.45); P(B(0.08, 0.45, 0.08), frame, 0, 0.25, 0.45);
    P(C(0.06, 0.45).rotateZ(Math.PI / 2), pad, 0, 0.8, 0.28);
  };
  const seatedRow = P => {
    P(B(0.3, 0.08, 2.3), frame, 0, 0.3, 0.25); for (const z of [1.25, -0.6]) P(B(0.08, 0.3, 0.08), frame, 0, 0.15, z);
    P(B(0.38, 0.1, 0.55), pad, 0, 0.4, 0.75);
    P(B(0.14, 2.2, 0.14), frame, 0, 1.1, -1.15); stack(P, 0, -0.9);
    P(B(0.55, 0.32, 0.05).rotateX(-0.35), paint, 0, 0.5, -0.25);
    P(C(0.006, 0.9).rotateX(Math.PI / 2), chrome, 0, 0.6, 0.1);
    P(B(0.2, 0.04, 0.04), chrome, 0, 0.6, 0.55);
  };
  const cables = P => {
    for (const x of [-1.6, 1.6]) {
      for (const z of [-0.3, 0.3]) P(B(0.1, 2.7, 0.1), frame, x, 1.35, z);
      stack(P, x, 0);
      P(B(0.03, 2.4, 0.03), paint, x, 1.3, 0.33);
      P(C(0.07, 0.05, 20).rotateX(Math.PI / 2), chrome, x * 0.88, 2.55, 0.3);
      P(B(0.01, 1.3, 0.01), chrome, x * 0.88, 1.85, 0.32);
      P(B(0.18, 0.03, 0.03), chrome, x * 0.88, 1.2, 0.32);
    }
    P(B(3.3, 0.12, 0.12), frame, 0, 2.7, 0);
    P(C(0.02, 1).rotateZ(Math.PI / 2), chrome, 0, 2.5, 0.2);
  };
  const treadmill = P => {
    P(B(0.85, 0.2, 2.0), frame, 0, 0.12, 0);
    P(B(0.6, 0.03, 1.75), rubber, 0, 0.235, 0.05);
    for (const x of [-0.41, 0.41]) { P(B(0.06, 0.04, 1.8), chrome, x, 0.24, 0.05); P(B(0.07, 1.2, 0.07).rotateX(0.15), frame, x, 0.8, -0.85); P(B(0.04, 0.04, 0.5), chrome, x, 1.05, -0.62); }
    P(B(0.85, 0.42, 0.14).rotateX(0.5), frame, 0, 1.38, -0.94);
    P(B(0.5, 0.26, 0.01).rotateX(0.5), screen, 0, 1.4, -0.86);
  };
  const bike = P => {
    P(B(0.5, 0.06, 1.0), frame, 0, 0.03, 0);
    P(B(0.08, 0.95, 0.08).rotateX(-0.35), frame, 0, 0.45, 0.2);
    P(B(0.24, 0.06, 0.3), pad, 0, 0.92, 0.36);
    P(B(0.08, 1.05, 0.08).rotateX(0.25), frame, 0, 0.55, -0.3);
    P(C(0.25, 0.06, 32).rotateZ(Math.PI / 2), chrome, 0, 0.4, -0.35);
    P(B(0.45, 0.04, 0.04), frame, 0, 1.08, -0.44);
    P(B(0.18, 0.12, 0.02), screen, 0, 1.1, -0.38);
  };
  const kbRack = P => {
    for (const y of [0.35, 0.8]) {
      P(B(1.8, 0.04, 0.45), frame, 0, y, 0);
      for (let k = 0; k < 6; k++) { const r = 0.08 + k * 0.012, x = -0.75 + k * 0.3; P(new THREE.SphereGeometry(r, 16, 12), rubber, x, y + 0.02 + r, 0); P(new THREE.TorusGeometry(r * 0.6, 0.015, 8, 20, Math.PI), frame, x, y + 0.02 + r * 1.75, 0); }
    }
    for (const x of [-0.9, 0.9]) P(B(0.05, 0.85, 0.45), frame, x, 0.42, 0);
  };
  const sled = P => {
    P(B(0.7, 0.06, 1.0), frame, 0, 0.05, 0); for (const x of [-0.3, 0.3]) P(B(0.05, 0.05, 1.1), chrome, x, 0.02, 0);
    for (const x of [-0.25, 0.25]) P(B(0.05, 1.0, 0.05).rotateX(-0.3), frame, x, 0.55, -0.35);
    P(C(0.03, 0.3), chrome, 0, 0.25, 0.1); for (let k = 0; k < 3; k++) P(C(0.225, 0.05, 40), rubber, 0, 0.11 + k * 0.055, 0.1);
  };
  const plyo = P => { P(B(0.76, 0.6, 0.5), wood, 0, 0.3, 0); P(B(0.6, 0.45, 0.5), wood, 0.9, 0.225, 0.1); P(B(0.5, 0.3, 0.5), wood, 0.85, 0.75, 0.1); };
  const plateTree = P => {
    P(C(0.04, 1.3), chrome, 0, 0.65, 0); P(C(0.3, 0.05, 24), frame, 0, 0.03, 0);
    for (const [y, r] of [[0.4, 0.225], [0.75, 0.2], [1.05, 0.16]]) for (const s of [-1, 1]) P(C(r, 0.05, 32).rotateX(Math.PI / 2), rubber, 0, y, s * 0.1);
  };
  const reception = P => {
    P(B(4, 1.05, 0.8), white, 0, 0.525, 0); P(B(4.2, 0.05, 0.95), wood, 0, 1.08, -0.05);
    P(B(4, 0.04, 0.02), M.mint, 0, 0.12, 0.41);
    P(B(5, 3, 0.15), wood, 0, 1.5, -2.2);
    P(B(0.5, 0.35, 0.03), screen, 0.8, 1.3, -0.2);
  };
  const lamp = P => { P(B(3.2, 0.07, 0.2), frame, 0, 6.5, 0); P(B(3, 0.02, 0.14), MAT.led, 0, 6.455, 0); for (const x of [-1.4, 1.4]) P(C(0.006, H - 6.5), chrome, x, 6.5 + (H - 6.5) / 2, 0); };

  // Distribución de un gimnasio real: nada en espejo
  const L90 = Math.PI / 2;
  for (let i = 0; i < 5; i++) treadmill(station(-15 + i * 1.7, 10.2, Math.PI));
  for (let i = 0; i < 5; i++) bike(station(-14.6 + i * 1.5, 6.6, Math.PI));
  reception(station(10.5, 9.4, Math.PI));
  dbRack(station(16.1, -1.5, -L90), 11);
  bench(station(13.6, 2.6, 0.2)); adjBench(station(13.4, -0.8, -L90)); adjBench(station(13.8, -4.2, -L90 + 0.4)); bench(station(13.2, -7.2, 0));
  dumbbell(station(12.9, -3.2, 0.7), 0, 0, 0, 1.1); dumbbell(station(13.3, -3.0, 0.2), 0, 0, 0, 1.1);
  for (const [x, n] of [[-13.2, 3], [-9.4, 2], [-5.6, 4]]) powerRack(station(x, -3.2), n);
  barbell(station(-9.4, -6.2), 0.225, 0, 2.2, 3);
  smith(station(6.6, -0.6, -L90));
  legPress(station(11.6, -7.4, -L90 + 0.15));
  latPulldown(station(6.4, -9.6, -L90));
  seatedRow(station(12.2, -13.4, -L90));
  cables(station(5, -18.4));
  adjBench(station(5, -16.6, Math.PI));
  plateTree(station(3.6, -5.4)); plateTree(station(9.4, -3.6)); plateTree(station(-2.8, -9.5));
  kbRack(station(-16.3, -10.5, L90));
  sled(station(-11.2, -10.2)); sled(station(-13.6, -12.6, 0.3));
  plyo(station(-14.6, -19.4));
  // Máquinas de placas y selectorizadas: asiento, respaldo, pila, brazos y detalles (costuras, pomos, placa de marca)
  const seam = (P, w, y, z) => P(B(w, 0.006, 0.006), frame, 0, y, z);
  const seatPad = (P, y, z, w = 0.48, d = 0.45) => { P(B(w, 0.1, d), pad, 0, y, z); P(B(w - 0.04, 0.03, d - 0.04), frame, 0, y - 0.065, z); seam(P, w - 0.02, y + 0.051, z + d / 2 - 0.03); };
  const backPad = (P, y, z, tilt = 0.15, w = 0.48, h = 0.7) => { P(B(w, h, 0.1).rotateX(-tilt), pad, 0, y, z); P(B(w - 0.06, h - 0.06, 0.03).rotateX(-tilt), frame, 0, y, z - 0.065); };
  const badge = (P, x, y, z) => P(B(0.22, 0.07, 0.01), MAT.paint, x, y, z);
  const selector = (P, ox = 0, oz = -0.55, hgt = 2.1) => {
    P(B(0.12, hgt, 0.12), frame, ox - 0.32, hgt / 2, oz); P(B(0.12, hgt, 0.12), frame, ox + 0.32, hgt / 2, oz);
    P(B(0.76, 0.12, 0.14), frame, ox, hgt, oz);
    stack(P, ox, oz + 0.02);
    P(B(0.02, hgt - 0.2, 0.02), paint, ox + 0.38, hgt / 2, oz + 0.07);
    P(C(0.025, 0.06).rotateX(Math.PI / 2), MAT.paint, ox + 0.18, 0.74, oz + 0.17);
    P(B(0.7, 0.4, 0.02), MAT.clear, ox, 0.6, oz + 0.18);
    badge(P, ox, hgt - 0.12, oz + 0.08);
  };
  const chestPress = P => {
    P(B(0.9, 0.08, 1.4), frame, 0, 0.04, 0);
    selector(P); seatPad(P, 0.5, 0.25); backPad(P, 0.95, 0.02, 0.12);
    P(B(0.1, 0.5, 0.1), frame, 0, 0.25, 0.25);
    for (const s of [-1, 1]) { P(B(0.06, 0.06, 0.6), frame, s * 0.36, 1.2, 0.35); P(C(0.022, 0.18).rotateX(0.2), pad, s * 0.36, 1.12, 0.62); P(B(0.06, 0.9, 0.06).rotateX(0.2), frame, s * 0.36, 1.55, 0.02); }
  };
  const pecDeck = P => {
    P(B(0.9, 0.08, 1.3), frame, 0, 0.04, 0);
    selector(P); seatPad(P, 0.5, 0.2); backPad(P, 1.0, 0.0, 0.05, 0.42, 0.8);
    for (const s of [-1, 1]) { P(B(0.5, 0.05, 0.05), frame, s * 0.3, 1.85, 0.05); P(B(0.05, 0.75, 0.05), frame, s * 0.52, 1.45, 0.1); P(B(0.14, 0.5, 0.08), pad, s * 0.52, 1.25, 0.18); }
  };
  const legExt = P => {
    P(B(0.8, 0.08, 1.3), frame, 0, 0.04, 0);
    selector(P, 0, -0.5, 1.8); seatPad(P, 0.55, 0.2, 0.46, 0.5); backPad(P, 0.95, -0.08, 0.2, 0.46, 0.6);
    P(B(0.1, 0.5, 0.1), frame, 0, 0.27, 0.2);
    for (const s of [-1, 1]) P(B(0.05, 0.4, 0.05), frame, s * 0.3, 0.38, 0.45);
    P(C(0.045, 0.5, 20).rotateZ(Math.PI / 2), pad, 0, 0.25, 0.6); P(C(0.04, 0.5, 20).rotateZ(Math.PI / 2), pad, 0, 0.55, 0.52);
    P(B(0.04, 0.3, 0.04), frame, 0, 0.4, 0.58);
  };
  const hackSquat = P => {
    P(B(1.2, 0.1, 2.4), frame, 0, 0.05, 0);
    P(B(0.8, 0.06, 0.7).rotateX(-0.25), MAT.paint, 0, 0.14, 0.75);
    for (const x of [-0.42, 0.42]) P(B(0.09, 0.09, 2.5).rotateX(1.0), frame, x, 1.1, -0.15);
    P(B(0.5, 0.9, 0.1).rotateX(1.0 - Math.PI / 2), pad, 0, 1.15, 0.05);
    for (const s of [-1, 1]) { P(C(0.06, 0.2).rotateX(0.6), pad, s * 0.2, 1.68, 0.12); P(C(0.03, 0.3).rotateZ(Math.PI / 2), chrome, s * 0.6, 1.0, -0.1); for (let k = 0; k < 3; k++) P(C([0.225, 0.2, 0.16][k], 0.05, 40).rotateZ(Math.PI / 2), rubber, s * (0.56 + k * 0.055), 1.0, -0.1); }
    for (const x of [-0.5, 0.5]) P(B(0.1, 2.1, 0.1), frame, x, 1.05, -1.0);
    badge(P, 0, 2.0, -0.94);
  };
  const hipThrust = P => {
    P(B(1.4, 0.08, 1.4), frame, 0, 0.04, 0);
    P(B(1.2, 0.18, 0.35), pad, 0, 0.42, -0.45); P(B(0.08, 0.35, 0.3), frame, 0, 0.2, -0.45);
    barbell(P, 0.225, 0.25, 2.0, 2);
    P(C(0.06, 0.6, 16).rotateZ(Math.PI / 2), pad, 0, 0.225, 0.25);
  };
  const benchWithBells = (P, z, n = 2) => { adjBench(P); for (let i = 0; i < n; i++) dumbbell(P, 0.3 + i * 0.05, 0, 0.7 + i * 0.25, 0.9); };

  // Zona de peso libre delante de los racks: mancuernero + bancos muy juntos
  dbRack(station(-9.5, 4.6, Math.PI), 9);
  for (const x of [-13.2, -11.6, -10, -8.4, -6.8]) benchWithBells(station(x, 2.6, Math.PI + (x % 3) * 0.08));
  // Bloque de máquinas a la derecha, en filas de 1,3 m como en una sala real
  chestPress(station(4.4, 5.6, -L90)); pecDeck(station(4.4, 4.2, -L90)); chestPress(station(4.4, 2.8, -L90));
  legExt(station(9.6, -1.8, -L90)); hackSquat(station(9.4, -4.6, -L90 + 0.1));
  chestPress(station(9.4, -10.6, -L90)); pecDeck(station(9.4, -12.0, -L90)); legExt(station(9.4, -13.4, -L90));
  legExt(station(14.6, -16.8, Math.PI)); pecDeck(station(13.2, -16.8, Math.PI)); hackSquat(station(15.4, -11, -L90));
  // Glúteo y peso libre detrás de los racks
  for (const z of [-8.6, -10.6, -12.6]) hipThrust(station(-4.6, z, L90));
  benchWithBells(station(-4.4, -15.6, L90 - 0.2)); benchWithBells(station(-4.6, -17.8, L90 + 0.1));
  dbRack(station(-3.2, -20.2), 5);
  barbell(station(-11.8, -15.8, 0.4), 0.225, 0, 2.2, 3);
  for (let x = -12; x <= 12; x += 6) for (let z = 9; z >= -19; z -= 5.6) lamp(station(x, z));
  const interior = new THREE.Group(); gym.add(interior); // se oculta mientras se está en el cielo
  for (const [mat, list] of parts) interior.add(new THREE.Mesh(mergeGeometries(list), mat));

  /* Anillas de gimnasia */
  const rings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(-12.5 + s * 0.3, H - 0.2, -17); gym.add(pivot);
    const SL = H - 0.2 - 2.6;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, SL, 0.012), MAT.pad); strap.position.y = -SL / 2; pivot.add(strap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 12, 48), MAT.wood); ring.position.y = -SL - 0.12; pivot.add(ring);
    rings.push({ pivot, s });
  }

  /* Portal del fondo */
  const portal = new THREE.Group(); portal.position.set(0, 4.6, Z1 + 0.6); gym.add(portal);
  portal.add(new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.07, 24, 240), M.blue));
  const portalMint = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.02, 8, 240), M.mint); portal.add(portalMint);

  /* Luces */
  scene.add(new THREE.HemisphereLight('#6f8fd8', '#03050c', 0.35));
  const moon = new THREE.DirectionalLight('#9fb8ff', 1.2); moon.position.set(-40, 80, -120); scene.add(moon);
  for (const [x, z] of [[-4, 3], [4, -11]]) { const l = new THREE.PointLight('#e8efff', 170, 38, 1.5); l.position.set(x, 6, z); gym.add(l); }
  const entry = new THREE.PointLight('#ffd9b0', 50, 14, 1.5); entry.position.set(0, 4.3, Z0 + 2.2); gym.add(entry);
  

  /* Polvo flotando en la sala */
  const nDust = small ? 900 : 1800, dp = new Float32Array(nDust * 3);
  for (let i = 0; i < nDust; i++) { dp[i * 3] = (Math.random() - 0.5) * (W - 2); dp[i * 3 + 1] = Math.random() * (H - 1); dp[i * 3 + 2] = Z0 - Math.random() * L; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: 14 * DPR } },
    vertexShader: 'uniform float uSize; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); float d = -mv.z; gl_PointSize = min(uSize / d, 5.); vA = smoothstep(.8, 3., d) * (1. - smoothstep(18., 30., d)); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float a = smoothstep(.5, 0., length(gl_PointCoord - .5)) * vA * .7; gl_FragColor = vec4(vec3(.62,.75,1.) * a, a); }',
  }));
  gym.add(dust);

  /* Partículas que forman las iniciales */
  const jr = (() => {
    const N = small ? 3500 : 6500;
    const c = document.createElement('canvas'); c.width = 640; c.height = 320;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = '600 270px Geist, ui-sans-serif, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('JR', 320, 172);
    const data = g.getImageData(0, 0, 640, 320).data, pts = [];
    for (let y = 0; y < 320; y += 2) for (let x = 0; x < 640; x += 2) if (data[(y * 640 + x) * 4 + 3] > 140) pts.push([x, y]);
    const start = new Float32Array(N * 3), target = new Float32Array(N * 3), rnd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const [x, y] = pts[(Math.random() * pts.length) | 0] || [320, 160];
      target[i * 3] = (x - 320) / 640 * 7.4 + (Math.random() - 0.5) * 0.02; target[i * 3 + 1] = -(y - 160) / 640 * 7.4; target[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 7;
      start[i * 3] = Math.cos(a) * r; start[i * 3 + 1] = (Math.random() - 0.5) * 9; start[i * 3 + 2] = Math.sin(a) * r * 0.6 + 4;
      rnd[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uMorph: { value: 0 }, uTime: { value: 0 }, uSize: { value: 26 * DPR } },
      vertexShader: `attribute vec3 aTarget; attribute float aRnd; uniform float uMorph, uTime, uSize; varying float vA; varying vec3 vC;
        void main(){
          float m = smoothstep(aRnd * .45, aRnd * .45 + .55, uMorph);
          vec3 p = mix(position, aTarget, m);
          float k = (1. - m) * .6 + .015;
          p += vec3(sin(uTime * .7 + aRnd * 40.), cos(uTime * .6 + aRnd * 31.), sin(uTime * .5 + aRnd * 17.)) * k;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_PointSize = uSize * (.55 + aRnd * .7) / -mv.z;
          gl_Position = projectionMatrix * mv;
          vA = .25 + .75 * m; vC = mix(vec3(.25,.48,1.), vec3(.24,.95,.7), aRnd);
        }`,
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(vC * 1.8 * a * vA, a * vA); }',
    });
    const pts3 = new THREE.Points(geo, mat); pts3.position.copy(portal.position); pts3.position.z += 0.6; pts3.scale.setScalar(0.75);
    gym.add(pts3);
    return mat;
  })();

  /* ---------- Recorrido de cámara ---------- */
  // Cielo → bajada a la calle → puerta doble (se abre) → pasillo del gimnasio mirando a cada lado → portal del fondo
  const K = [
    [0.00, [0, 132, 190], [0, 108, -260]],
    [0.06, [0, 118, 172], [0, 70, -120]],
    [0.12, [0, 82, 130], [0, 18, 0]],
    [0.18, [0, 40, 84], [0, 8, 0]],
    [0.23, [0, 14, 52], [0, 6, 0]],
    [0.27, [0, 3.6, 32], [0, 4.4, Z0]],
    [0.32, [0, 2, 21], [0, 2.3, 4]],
    [0.36, [0, 1.75, 11], [0, 1.9, 0]],
    [0.42, [0.4, 1.75, 7], [-12, 1.3, 8.5]],
    [0.48, [1, 1.75, 3], [16, 1.2, -2]],
    [0.56, [0.6, 1.75, -1.5], [-10, 1.4, -5]],
    [0.64, [0.8, 1.8, -7], [12, 1.4, -11]],
    [0.72, [0, 1.9, -9], [-12, 1.5, -15]],
    [0.80, [0, 2.3, -10], [0, 3.6, -21]],
    [0.90, [0, 3.6, -10.5], [0, 4.6, -25]],
    [1.00, [0, 4.2, -11.2], [0, 4.6, -25]],
  ];


  const posCurve = new THREE.CatmullRomCurve3(K.map(k => new THREE.Vector3(...k[1])), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(K.map(k => new THREE.Vector3(...k[2])), false, 'centripetal');
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function pathAt(p) {
    let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const t = range(p, K[i][0], K[i + 1][0]);
    const u = (i + t) / (K.length - 1);
    posCurve.getPoint(u, camPos); lookCurve.getPoint(u, camLook);
  }

  /* ---------- Postproceso ---------- */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), small ? 0.6 : 0.75, 0.42, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr);
    renderer.setSize(w, h, false); composer.setSize(w, h);
    bloom.setSize(w * dpr * 0.35, h * dpr * 0.35);
    camera.aspect = w / h; camera.fov = w / h < 0.85 ? 62 : 45; camera.updateProjectionMatrix();
  }
  let lastW = 0, lastH = 0;
  addEventListener('resize', () => {
    if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 160) return;
    lastW = innerWidth; lastH = innerHeight; resize();
  });
  lastW = innerWidth; lastH = innerHeight; resize();

  /* ---------- Bucle ---------- */
  const mouse = new THREE.Vector2(), mouseS = new THREE.Vector2();
  addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }, { passive: true });
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(story);
  const clock = new THREE.Clock(); let t = 0, p = pTarget, first = true;
  const right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3();

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    p = reduce ? pTarget : p + (pTarget - p) * (1 - Math.exp(-dt * 2.6));
    const week = updateText(p);
    if (!visible && !first) return;
    if (!reduce) t += dt;

    // Cámara y paralaje con el ratón
    pathAt(p);
    mouseS.lerp(mouse, 1 - Math.exp(-dt * 3));
    fwd.subVectors(camLook, camPos).normalize(); right.crossVectors(fwd, up).normalize();
    const inside = range(p, 0.30, 0.37);
    const amp = lerp(4, 0.35, inside);
    camera.position.copy(camPos).addScaledVector(right, mouseS.x * amp).addScaledVector(up, mouseS.y * amp * 0.5);
    camera.lookAt(camLook);

    // Niebla: fina fuera, densa dentro
    scene.fog.density = lerp(0.0016, 0.012, inside);
    clouds.visible = p < 0.3;
    city.visible = p < 0.38;
    interior.visible = p > 0.17;
    dust.visible = p > 0.3;
    scene.environmentIntensity = lerp(0.45, 0.85, inside);
    sky.visible = p < 0.37;
    // La puerta se abre mientras te acercas
    const open = smooth(range(p, 0.27, 0.335));
    doors.forEach(({ pivot, s }) => { pivot.rotation.y = -s * open * 1.45; });

    // Animación de los objetos
    clouds.children.forEach((c, i) => { c.position.x += Math.sin(i) * dt * 0.6; });
    rings.forEach(({ pivot, s }) => { pivot.rotation.x = Math.sin(t * 0.9 + s) * 0.07; pivot.rotation.z = Math.sin(t * 0.7 + s * 2) * 0.03; });
    portal.rotation.z = t * 0.1; portalMint.rotation.z = -t * 0.18;
    dust.rotation.y = Math.sin(t * 0.05) * 0.02; dust.position.y = Math.sin(t * 0.3) * 0.15;

    // Semanas: se enciende una columna por cada semana del capítulo 2

    jr.uniforms.uMorph.value = smooth(range(p, 0.86, 0.98));
    jr.uniforms.uTime.value = t;

    composer.render();
    if (first) { first = false; stage.classList.add('is-ready'); }
    adapt(dt);
  }

  let acc = 0, frames = 0, settle = 0, adaptRounds = 0;
  function adapt(dt) {
    acc += dt; frames++;
    if (frames < (adaptRounds < 6 ? 20 : 40)) return;
    adaptRounds++;
    const avg = acc / frames; acc = 0; frames = 0;
    if (settle-- > 0) return;
    let next = dpr;
    if (avg > 1 / 48 && dpr > DPR_MIN) next = Math.max(DPR_MIN, dpr - 0.15);
    else if (avg < 1 / 58 && dpr < DPR_MAX) next = Math.min(DPR_MAX, dpr + 0.05);
    if (next !== dpr) { dpr = next; resize(); settle = 2; }
  }

  // Modo foto (?shot=all): encuadres fijos del gimnasio que se guardan como imágenes de la página.
  const SHOT = new URLSearchParams(location.search).get('shot');
  if (!SHOT) {
    const go = () => tick();
    // Subir todas las texturas a la GPU antes de empezar: si no, cada una da un tirón la primera vez que aparece
    scene.traverse(o => [].concat(o.material || []).forEach(m => ['map', 'emissiveMap'].forEach(k => m[k] && renderer.initTexture(m[k]))));
    if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(go, go); else { renderer.compile(scene, camera); go(); }
    return;
  }
  const SHOTS = {
    plan: { w: 1400, h: 1300, fov: 36, pos: [2.9, 4.6, 3.6], look: [0.15, 3.5, 0], inside: 1, glow: 0.35 },
    tecnica: { w: 1600, h: 760, fov: 32, pos: [-2.15, 0.7, -15.9], look: [-1.2, 0.6, -17], inside: 1, glow: 0.18 },
    semanas: { w: 1000, h: 1000, fov: 38, pos: [-4.9, 1.2, -3.2], look: [-6.5, 4.4, -16], inside: 1, glow: 0.38 },
    anillas: { w: 1000, h: 1000, fov: 30, pos: [0, 6.85, -32.6], look: [0, 6.8, -36], inside: 1, glow: 0.12 },
    sala: { w: 1800, h: 560, fov: 50, pos: [0, 8.4, 7.4], look: [0, 3, -30], inside: 1, glow: 0.25 },
    portal: { w: 1000, h: 1250, fov: 40, pos: [0, 6.2, -38.6], look: [0, 6.2, -48], inside: 1, glow: 0.2 },
  };
  (async () => {
    t = 2.4;
    rings.forEach(({ pivot }) => pivot.rotation.set(0, 0, 0));
    jr.uniforms.uMorph.value = 1; jr.uniforms.uTime.value = t;
    for (const [name, s] of Object.entries(SHOTS)) {
      if (SHOT !== 'all' && SHOT !== name) continue;
      renderer.setPixelRatio(1); renderer.setSize(s.w, s.h, false); composer.setSize(s.w, s.h); bloom.setSize(s.w / 2, s.h / 2);
      camera.aspect = s.w / s.h; camera.fov = s.fov; camera.updateProjectionMatrix();
      camera.position.set(...s.pos); camera.lookAt(...s.look);
      scene.fog.density = lerp(0.0016, 0.011, s.inside);
      renderer.toneMappingExposure = 0.74; bloom.strength = 0.45;
      clouds.visible = sky.visible = !s.inside;
      composer.render();
      const url = renderer.domElement.toDataURL('image/webp', 0.86);
      await fetch(`/save?name=${name}`, { method: 'POST', body: url });
    }
    document.title = 'shots done';
    window.__dbg = { scene, render: () => composer.render() };
  })();
}
