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
  el.innerHTML = el.textContent.trim().split(/s+/).map((w, i) => `<span class="hw"><span style="--i:${i}">${w}</span></span>`).join(' ');
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
  const DPR_MAX = Math.min(devicePixelRatio, small ? 1.1 : 1.35), DPR_MIN = small ? 0.6 : 0.7;
  let dpr = DPR_MAX;
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
    chrome: new THREE.MeshStandardMaterial({ color: '#d6e0ff', metalness: 1, roughness: 0.14 }),
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
  const nClouds = small ? 36 : 110;
  for (let i = 0; i < nClouds; i++) {
    const m = new THREE.SpriteMaterial({ map: puffs[i % 3], color: new THREE.Color().setHSL(0.62, 0.55, 0.26 + Math.random() * 0.16), transparent: true, opacity: 0.32 + Math.random() * 0.3, depthWrite: false, rotation: Math.random() * 6.28 });
    const sp = new THREE.Sprite(m);
    const a = Math.random() * Math.PI * 2, r = 25 + Math.pow(Math.random(), 0.7) * 520;
    sp.position.set(Math.cos(a) * r, 40 + Math.random() * 18, Math.sin(a) * r - 120);
    const s = 110 + Math.random() * 140; sp.scale.set(s, s * 0.3, 1);
    clouds.add(sp);
  }
  scene.add(clouds);

  /* ---------- Ciudad de noche ---------- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({
    color: '#03050c', roughness: 0.9, metalness: 0.1,
    emissive: '#ffffff', emissiveIntensity: 0.16,
    emissiveMap: (() => { const t = canvasTexture(512, 512, (g, w) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(80,130,255,.55)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, w); g.stroke(); g.beginPath(); g.moveTo(0, i * w / 4); g.lineTo(w, i * w / 4); g.stroke(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); return t; })(),
  }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
  scene.add(ground);
  const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), M.dark, small ? 220 : 380);
  const lightPos = [], lightCol = [];
  const tmp = new THREE.Object3D(), cA = new THREE.Color('#9fc0ff'), cB = new THREE.Color('#3cf2b4'), cC = new THREE.Color('#ffe6b8');
  for (let i = 0, n = towers.count; i < n; i++) {
    let x, z;
    do { x = (Math.random() - 0.5) * 520; z = (Math.random() - 0.5) * 520 - 40; } while (Math.abs(x) < 30 && z > -80 && z < 30);
    const h = 6 + Math.pow(Math.random(), 2.2) * 46, w = 5 + Math.random() * 9, d = 5 + Math.random() * 9;
    tmp.position.set(x, 0, z); tmp.scale.set(w, h, d); tmp.updateMatrix(); towers.setMatrixAt(i, tmp.matrix);
    for (let k = 0; k < 10; k++) {
      const side = Math.random() < 0.5;
      lightPos.push(x + (side ? (Math.random() < 0.5 ? -w / 2 - 0.05 : w / 2 + 0.05) : (Math.random() - 0.5) * w), Math.random() * h, z + (side ? (Math.random() - 0.5) * d : (Math.random() < 0.5 ? -d / 2 - 0.05 : d / 2 + 0.05)));
      const c = Math.random() < 0.6 ? cA : Math.random() < 0.6 ? cC : cB; lightCol.push(c.r, c.g, c.b);
    }
  }
  scene.add(towers);
  const dot = canvasTexture(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const lgGeo = new THREE.BufferGeometry();
  lgGeo.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
  lgGeo.setAttribute('color', new THREE.Float32BufferAttribute(lightCol, 3));
  scene.add(new THREE.Points(lgGeo, new THREE.PointsMaterial({ size: 1.1, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

  /* ---------- El gimnasio ---------- */
  const W = 24, Z0 = 10, Z1 = -50, H = 14, L = Z0 - Z1, ZC = (Z0 + Z1) / 2;
  const gym = new THREE.Group(); scene.add(gym);
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); gym.add(m); return m; };
  // Paredes de cristal oscuro
  box(0.4, H, L, M.glass, -W / 2, H / 2, ZC);
  box(0.4, H, L, M.glass, W / 2, H / 2, ZC);
  box(W, H, 0.4, M.glass, 0, H / 2, Z1);
  box(W, H, 0.4, M.glass, 0, H / 2, Z0);
  // Techo con óculo
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-W / 2, -Z0); roofShape.lineTo(W / 2, -Z0); roofShape.lineTo(W / 2, -Z1); roofShape.lineTo(-W / 2, -Z1); roofShape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 4.6, 0, Math.PI * 2, true); roofShape.holes.push(hole);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 0.5, bevelEnabled: false, curveSegments: 64 }), M.glass);
  roof.rotation.x = Math.PI / 2; roof.position.y = H + 0.5; gym.add(roof);
  const oculusRim = new THREE.Mesh(new THREE.TorusGeometry(4.65, 0.08, 16, 160), M.white); oculusRim.rotation.x = Math.PI / 2; oculusRim.position.y = H + 0.55; gym.add(oculusRim);
  // Lamas de luz en la fachada
  const finGeo = new THREE.BoxGeometry(0.12, H - 1, 0.12);
  const fins = new THREE.InstancedMesh(finGeo, M.blue, 2 * Math.floor(L / 2.4) + 2 * Math.floor(W / 2.4));
  let fi = 0;
  for (let z = Z0 - 1.2; z > Z1; z -= 2.4) for (const s of [-1, 1]) { tmp.position.set(s * (W / 2 + 0.3), H / 2, z); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); fins.setMatrixAt(fi++, tmp.matrix); }
  for (let x = -W / 2 + 1.2; x < W / 2; x += 2.4) for (const zz of [Z0 + 0.3, Z1 - 0.3]) { tmp.position.set(x, H / 2, zz); tmp.updateMatrix(); fins.setMatrixAt(fi++, tmp.matrix); }
  fins.count = fi; gym.add(fins);
  // Halo flotante sobre el óculo
  const halo = new THREE.Group(); halo.position.y = H + 4.2; gym.add(halo);
  const haloA = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.16, 24, 240), M.mint); haloA.rotation.x = Math.PI / 2; halo.add(haloA);
  const haloB = new THREE.Mesh(new THREE.TorusGeometry(8.1, 0.05, 12, 240), M.blue); haloB.rotation.x = Math.PI / 2; halo.add(haloB);
  const haloC = new THREE.Mesh(new THREE.TorusGeometry(6.3, 0.05, 12, 240), M.blue); haloC.rotation.x = Math.PI / 2; halo.add(haloC);
  // Haz de luz que cae por el óculo
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.6, H, 64, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){ float a = smoothstep(0., 1., vUv.y) * .07; a *= .75 + .25 * sin(vUv.x * 60. + uTime * .6) * sin(vUv.x * 23. - uTime * .4);
        gl_FragColor = vec4(vec3(.55,.75,1.) * a, a); }`,
  }));
  beam.position.y = H / 2; gym.add(beam);

  // Suelo con rejilla y franjas de luz
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, L - 0.4), new THREE.MeshStandardMaterial({
    color: '#05080f', roughness: 0.22, metalness: 0.75, emissive: '#ffffff', emissiveIntensity: 0.3,
    emissiveMap: (() => { const t = canvasTexture(256, 256, (g, w) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(70,120,255,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, w); }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W / 2, L / 2); return t; })(),
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, ZC); gym.add(floor);
  // Tiras del techo como paneles planos: vistas de frente no dejan un cuadrado brillante en el fondo
  for (const x of [-7, 0, 7]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.35, L - 6), M.white); s.rotation.x = Math.PI / 2; s.position.set(x, H - 0.4, ZC + 2); gym.add(s); }
  for (const s of [-1, 1]) { box(0.05, 0.06, L - 1, M.blue, s * (W / 2 - 0.25), 0.35, ZC); box(0.05, 0.06, L - 1, M.blue, s * (W / 2 - 0.25), H - 2, ZC); }

  // Estanterías de mancuernas a lo largo de las paredes
  const head = new THREE.CylinderGeometry(0.13, 0.13, 0.15, 6).rotateZ(Math.PI / 2);
  const dbGeo = mergeGeometries([new THREE.CylinderGeometry(0.035, 0.035, 0.42, 12).rotateZ(Math.PI / 2), head.clone().translate(-0.25, 0, 0), head.clone().translate(0.25, 0, 0)]);
  const nDb = 2 * 2 * 34;
  const dbs = new THREE.InstancedMesh(dbGeo, M.rubber, nDb);
  let di = 0;
  for (const s of [-1, 1]) for (const y of [0.85, 1.45]) for (let k = 0; k < 34; k++) {
    tmp.position.set(s * (W / 2 - 1.2), y, Z0 - 3 - k * 1.45); tmp.rotation.set(0, Math.PI / 2, 0); tmp.scale.setScalar(0.9 + (k % 5) * 0.06); tmp.updateMatrix(); dbs.setMatrixAt(di++, tmp.matrix);
  }
  gym.add(dbs);
  for (const s of [-1, 1]) for (const y of [0.65, 1.25]) box(0.9, 0.06, L - 6, M.chrome, s * (W / 2 - 1.2), y, ZC - 2);

  /* Disco de pesas central con el nombre grabado */
  const prof = [[0.26, -0.22], [0.55, -0.22], [0.62, -0.12], [1.95, -0.12], [2.03, -0.17], [2.19, -0.17], [2.25, -0.11], [2.25, 0.11], [2.19, 0.17], [2.03, 0.17], [1.95, 0.12], [0.62, 0.12], [0.55, 0.22], [0.26, 0.22], [0.26, -0.22]].map(([x, y]) => new THREE.Vector2(x, y));
  const plateGeo = new THREE.LatheGeometry(prof, 180).rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 64, 1, true).rotateX(Math.PI / 2);
  const ringText = canvasTexture(1024, 1024, (g, w) => {
    g.translate(w / 2, w / 2);
    const R = (1.42 / 1.88) * (w / 2);
    g.fillStyle = '#ffffff'; g.font = '500 44px "Geist Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = 'JUANJO RAMOS · COACHING ONLINE 1 A 1 · ';
    const step = (Math.PI * 2) / txt.length;
    [...txt].forEach((ch, i) => { g.save(); g.rotate(i * step); g.translate(0, -R); g.fillText(ch, 0, 0); g.restore(); });
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, R + 44, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, R - 44, 0, 7); g.stroke();
    for (let i = 0; i < 120; i++) { g.save(); g.rotate(i * Math.PI / 60); g.fillRect(-1, -(R + 70), 2, i % 10 ? 10 : 22); g.restore(); }
  });
  const decalMat = new THREE.MeshBasicMaterial({ map: ringText, color: new THREE.Color('#8fb0ff').multiplyScalar(1.6), transparent: true, depthWrite: false, toneMapped: false });
  const makePlate = (scale, withText) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(plateGeo, M.rubber), new THREE.Mesh(hubGeo, M.chrome));
    for (const z of [-0.172, 0.172]) { const r = new THREE.Mesh(new THREE.TorusGeometry(2.11, 0.012, 8, 200), M.blue); r.position.z = z; g.add(r); }
    if (withText) for (const z of [-0.124, 0.124]) { const d = new THREE.Mesh(new THREE.RingGeometry(0.68, 1.88, 128), decalMat); d.position.z = z; if (z < 0) d.rotation.y = Math.PI; g.add(d); }
    g.scale.setScalar(scale); return g;
  };
  const plate = makePlate(1.1, true); plate.position.set(0, 3.6, 0); gym.add(plate);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.9, 64), M.dark); ped.position.set(0, 0.45, 0); gym.add(ped);
  const pedGlow = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.03, 8, 160), M.mint); pedGlow.rotation.x = Math.PI / 2; pedGlow.position.y = 0.06; gym.add(pedGlow);
  const pedTop = new THREE.Mesh(new THREE.TorusGeometry(1.41, 0.025, 8, 160), M.blue); pedTop.rotation.x = Math.PI / 2; pedTop.position.y = 0.91; gym.add(pedTop);

  /* Plataforma con barra cargada */
  const plat = new THREE.Group(); plat.position.set(0, 0, -17); gym.add(plat);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 2.6), M.dark); deck.position.y = 0.06; plat.add(deck);
  const deckLine = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.02, 2.65), M.blue); deckLine.position.y = 0.005; plat.add(deckLine);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.6, 24).rotateZ(Math.PI / 2), M.chrome); bar.position.y = 0.58; plat.add(bar);
  for (const s of [-1, 1]) {
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 24).rotateZ(Math.PI / 2), M.chrome); sl.position.set(s * 1.55, 0.58, 0); plat.add(sl);
    for (const k of [0, 1]) { const p = makePlate(0.25, false); p.rotation.y = Math.PI / 2; p.position.set(s * (1.38 + k * 0.1), 0.58, 0); plat.add(p); }
  }

  /* Doce columnas de luz: una por semana */
  const pillars = [];
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) {
    const mat = new THREE.MeshBasicMaterial({ color: '#16224a', toneMapped: false });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 7, 0.16), mat); m.position.set(s * 6.5, 3.5, -5 - i * 2.05); gym.add(m);
    pillars.push({ mat, i });
  }
  const pillarOff = new THREE.Color('#16224a'), pillarOn = new THREE.Color('#3cf2b4').multiplyScalar(2.4);

  /* Anillas de gimnasia */
  const rings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.95, H - 0.2, -36); gym.add(pivot);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 6.2, 0.015), M.dark); strap.position.y = -3.1; pivot.add(strap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 24, 120), M.chrome); ring.position.y = -6.75; pivot.add(ring);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.012, 8, 120), M.mint); glow.position.set(0, -6.75, 0.055); pivot.add(glow);
    rings.push({ pivot, s });
  }

  /* Portal del fondo */
  const portal = new THREE.Group(); portal.position.set(0, 6.2, Z1 + 1.2); gym.add(portal);
  portal.add(new THREE.Mesh(new THREE.TorusGeometry(5, 0.1, 24, 240), M.blue));
  const portalMint = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.025, 8, 240), M.mint); portal.add(portalMint);

  /* Luces */
  scene.add(new THREE.HemisphereLight('#6f8fd8', '#03050c', 0.35));
  const moon = new THREE.DirectionalLight('#9fb8ff', 1.2); moon.position.set(-40, 80, -120); scene.add(moon);
  const spot = new THREE.SpotLight('#cfe0ff', 260, 24, 0.55, 0.6, 1.6); spot.position.set(0, H + 2, 0); spot.target.position.set(0, 2.5, 0); gym.add(spot, spot.target);
  for (const [z, c, i] of [[-14, '#2f6bff', 110], [-38, '#3cf2b4', 90]]) { const l = new THREE.PointLight(c, i, 34, 1.5); l.position.set(0, 9, z); gym.add(l); }
  

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
    const pts3 = new THREE.Points(geo, mat); pts3.position.copy(portal.position); pts3.position.z += 0.6;
    gym.add(pts3);
    return mat;
  })();

  /* ---------- Recorrido de cámara ---------- */
  const K = [
    [0.00, [0, 132, 190], [0, 108, -260]],
    [0.06, [0, 122, 160], [0, 70, -120]],
    [0.12, [0, 96, 108], [0, 20, -10]],
    [0.17, [0, 56, 58], [0, 8, -4]],
    [0.22, [0, 32, 20], [0, 12, -2]],
    [0.26, [0, 21, 3], [0, 4, -1.5]],
    [0.30, [0.4, 10, 2.2], [0, 3.6, -0.4]],
    [0.34, [4.6, 4.3, 6.6], [0, 3.6, 0]],
    [0.44, [-5.2, 3.5, 5.4], [0, 3.4, 0]],
    [0.48, [2, 2.6, -2.6], [-1.6, 2.4, -14]],
    [0.64, [2, 2.6, -25.5], [-0.8, 3, -34]],
    [0.70, [3.3, 4.6, -28.6], [0, 7.2, -36]],
    [0.83, [-2.9, 6.1, -30.8], [0, 7, -36]],
    [0.90, [0, 6.3, -34.2], [0, 6.2, -48]],
    [1.00, [0, 6.25, -40.2], [0, 6.2, -48]],
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

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    p = reduce ? pTarget : p + (pTarget - p) * (1 - Math.exp(-dt * 2.6));
    const week = updateText(p);
    if (!visible && !first) return;
    if (!reduce) t += dt;

    // Cámara y paralaje con el ratón
    pathAt(p);
    mouseS.lerp(mouse, 1 - Math.exp(-dt * 3));
    fwd.subVectors(camLook, camPos).normalize(); right.crossVectors(fwd, up).normalize();
    const inside = range(p, 0.25, 0.31);
    const amp = lerp(4, 0.35, inside);
    camera.position.copy(camPos).addScaledVector(right, mouseS.x * amp).addScaledVector(up, mouseS.y * amp * 0.5);
    camera.lookAt(camLook);

    // Niebla: fina fuera, densa dentro
    scene.fog.density = lerp(0.0016, 0.03, inside);
    clouds.visible = p < 0.3;
    sky.visible = p < 0.32;

    // Animación de los objetos
    halo.rotation.y = t * 0.12; halo.position.y = H + 4.2 + Math.sin(t * 0.8) * 0.25;
    haloB.rotation.z = t * 0.2; haloC.rotation.z = -t * 0.25;
    plate.rotation.z = t * 0.35 + p * 6;
    plate.position.y = 3.6 + Math.sin(t * 1.1) * 0.06;
    beam.material.uniforms.uTime.value = t;
    clouds.children.forEach((c, i) => { c.position.x += Math.sin(i) * dt * 0.6; });
    rings.forEach(({ pivot, s }) => { pivot.rotation.x = Math.sin(t * 0.9 + s) * 0.07; pivot.rotation.z = Math.sin(t * 0.7 + s * 2) * 0.03; });
    portal.rotation.z = t * 0.1; portalMint.rotation.z = -t * 0.18;
    dust.rotation.y = Math.sin(t * 0.05) * 0.02; dust.position.y = Math.sin(t * 0.3) * 0.15;

    // Semanas: se enciende una columna por cada semana del capítulo 2
    const lit = p >= 0.46 ? week : 0;
    pillars.forEach(({ mat, i }) => { mat.color.lerp(i < lit ? pillarOn : pillarOff, 1 - Math.exp(-dt * 8)); });

    jr.uniforms.uMorph.value = smooth(range(p, 0.86, 0.98));
    jr.uniforms.uTime.value = t;

    composer.render();
    if (first) { first = false; stage.classList.add('is-ready'); }
    adapt(dt);
  }

  let acc = 0, frames = 0, settle = 0;
  function adapt(dt) {
    acc += dt; frames++;
    if (frames < 40) return;
    const avg = acc / frames; acc = 0; frames = 0;
    if (settle-- > 0) return;
    let next = dpr;
    if (avg > 1 / 48 && dpr > DPR_MIN) next = Math.max(DPR_MIN, dpr - 0.15);
    else if (avg < 1 / 58 && dpr < DPR_MAX) next = Math.min(DPR_MAX, dpr + 0.05);
    if (next !== dpr) { dpr = next; resize(); settle = 2; }
  }

  // Modo foto (?shot=all): encuadres fijos del gimnasio que se guardan como imágenes de la página.
  const SHOT = new URLSearchParams(location.search).get('shot');
  if (!SHOT) { frame(); return; }
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
    plate.rotation.z = 0.55; halo.rotation.y = 0.3;
    rings.forEach(({ pivot }) => pivot.rotation.set(0, 0, 0));
    pillars.forEach(({ mat }) => mat.color.copy(pillarOn));
    beam.material.uniforms.uTime.value = t;
    jr.uniforms.uMorph.value = 1; jr.uniforms.uTime.value = t;
    for (const [name, s] of Object.entries(SHOTS)) {
      if (SHOT !== 'all' && SHOT !== name) continue;
      renderer.setPixelRatio(1); renderer.setSize(s.w, s.h, false); composer.setSize(s.w, s.h); bloom.setSize(s.w / 2, s.h / 2);
      camera.aspect = s.w / s.h; camera.fov = s.fov; camera.updateProjectionMatrix();
      camera.position.set(...s.pos); camera.lookAt(...s.look);
      scene.fog.density = lerp(0.0016, 0.011, s.inside);
      renderer.toneMappingExposure = 0.74; bloom.strength = 0.45;
      pillars.forEach(({ mat }) => mat.color.copy(pillarOn).multiplyScalar(s.glow));
      clouds.visible = sky.visible = !s.inside;
      composer.render();
      const url = renderer.domElement.toDataURL('image/webp', 0.86);
      await fetch(`/save?name=${name}`, { method: 'POST', body: url });
    }
    document.title = 'shots done';
    window.__dbg = { scene, render: () => composer.render() };
  })();
}
