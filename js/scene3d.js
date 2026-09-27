'use strict';
/* ================= 3D: доска над облаками.
   Фигуры — скульптурные GLB-модели (Low Poly Chess Set v2, gubbins, CC BY 4.0),
   небо — фото HDRI Poly Haven (CC0), облака — CC0-спрайты zelun (OpenGameArt).
   Фолбэк: если GLB не загрузились — точёные lathe-фигуры. ================= */

const Scene3D = {
  init(canvas) {
    const R = this.R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    R.outputEncoding = THREE.sRGBEncoding;
    R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    this.resize(); addEventListener('resize', () => this.resize());

    this.scene = new THREE.Scene();
    this._sky();
    this.scene.fog = new THREE.Fog(0xdceaf5, 34, 110);

    this.cam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 300);
    this.yaw = 0; this.pitch = 0.9; this.rad = 11;
    this._camUpdate();

    this.scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x8fa3bd, 0.8));
    const d = new THREE.DirectionalLight(0xfff2dc, 1.15);
    d.position.set(9, 16, 6);
    d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048);
    d.shadow.camera.left = -7; d.shadow.camera.right = 7;
    d.shadow.camera.top = 7; d.shadow.camera.bottom = -7;
    d.shadow.camera.near = 2; d.shadow.camera.far = 45;
    d.shadow.bias = -0.0004;
    this.scene.add(d);
    const fill = new THREE.DirectionalLight(0xcfe2ff, 0.3);
    fill.position.set(-7, 9, -5);
    this.scene.add(fill);

    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    this._build();
    this._clouds();
    this._input(canvas);
    this._loadPieces();

    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;
      if (!this.freeze) {           // тесты могут заморозить покачивание
        this.boardGroup.position.y = Math.sin(t * 0.7) * 0.05;
        this.boardGroup.rotation.z = Math.sin(t * 0.5) * 0.004;
      }
      for (const c of this.clouds) {
        c.position.x += c.userData.v * dt;
        if (c.position.x > c.userData.bound) c.position.x = -c.userData.bound;
      }
      R.render(this.scene, this.cam);
    };
    loop();
  },
  resize() { this.R.setSize(innerWidth, innerHeight, false); this.cam && (this.cam.aspect = innerWidth / innerHeight, this.cam.updateProjectionMatrix()); },

  /* квадрат (f,r): f=a..h(0..7), r=1..8(0..7), белые снизу */
  posOf(f, r) { return { x: f - 3.5, z: 3.5 - r }; },

  /* ---- небо: фото-панорама Poly Haven (CC0) на сфере, без тонмаппинга ---- */
  _sky() {
    const loader = new THREE.TextureLoader();
    loader.load('assets/sky.jpg', (t) => {
      t.encoding = THREE.sRGBEncoding;
      t.wrapS = THREE.RepeatWrapping;
      // сфера-небо (не тонмапится, не туманится); полоса облаков сидит сразу под экватором — видна при игре
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(170, 48, 32),
        new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, toneMapped: false }));
      this.scene.add(sky);
      this.skyMesh = sky;
      // то же фото — как окружение для PBR-бликов
      const env = t.clone();
      env.mapping = THREE.EquirectangularReflectionMapping;
      env.needsUpdate = true;
      this.scene.environment = env;
    }, undefined, () => {
      // фолбэк: градиент
      const c = document.createElement('canvas'); c.width = 2; c.height = 512;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#3f8fd6'); g.addColorStop(0.55, '#8ec3ec'); g.addColorStop(1, '#e8f2fb');
      x.fillStyle = g; x.fillRect(0, 0, 2, 512);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      this.scene.background = t;
    });
  },

  /* ---- облака: CC0-спрайты (zelun, OpenGameArt) ---- */
  _clouds() {
    this.clouds = [];
    const loader = new THREE.TextureLoader();
    let done = 0;
    const texs = [];
    for (let i = 1; i <= 10; i++) {
      loader.load('assets/clouds/c' + i + '.png', (t) => {
        t.encoding = THREE.sRGBEncoding;
        texs.push(t);
        if (++done === 10) this._placeClouds(texs);
      }, undefined, () => { if (++done === 10 && texs.length) this._placeClouds(texs); });
    }
    // если ни один не загрузился — процедурный фолбэк
    setTimeout(() => { if (!this.clouds.length) this._placeClouds([this._cloudTexFallback()]); }, 9000);
  },

  _placeClouds(texs) {
    const mk = (x, y, z, s, op, v, tex) => {
      const aspect = tex.image ? tex.image.height / tex.image.width : 0.3;
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z);
      sp.scale.set(s, s * aspect, 1);
      sp.userData = { v, bound: 46 };
      this.scene.add(sp);
      this.clouds.push(sp);
    };
    const T = (i) => texs[i % texs.length];
    // основание под доской — крупное кольцо пухлых облаков
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + Math.random() * 0.5;
      const r = 4.5 + Math.random() * 3.5;
      mk(Math.cos(a) * r, -1.5 - Math.random() * 0.9, Math.sin(a) * r, 6.5 + Math.random() * 4, 1.0, 0.1 + Math.random() * 0.12, T(i));
    }
    // дальние слои
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 26;
      mk(Math.cos(a) * r, -6 + Math.random() * 8, Math.sin(a) * r, 11 + Math.random() * 15, 0.6 + Math.random() * 0.4, 0.25 + Math.random() * 0.55, T(i * 3 + 1));
    }
    // высокие
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      mk(Math.cos(a) * 42, 4 + Math.random() * 6, Math.sin(a) * 42, 18 + Math.random() * 10, 0.45, 0.5 + Math.random() * 0.4, T(i * 7 + 2));
    }
  },

  _cloudTexFallback() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const cx = 40 + Math.random() * 176, cy = 100 + Math.random() * 70, r = 28 + Math.random() * 44;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  },

  _build() {
    const M = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.matW = new THREE.MeshStandardMaterial({ color: 0xf2eee3, roughness: 0.38, metalness: 0.06, envMapIntensity: 0.35 });
    this.matB = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.44, metalness: 0.1, envMapIntensity: 0.4 });
    this.matSqW = M(0xece1c9); this.matSqB = M(0x8a5f3e);

    const box = new THREE.BoxGeometry(1, 0.14, 1);
    const geos = { w: [], b: [] };
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const p = this.posOf(f, r);
      geos[(f + r) % 2 ? 'w' : 'b'].push({ geo: box, matrix: trs(p.x, -0.07, p.z, 0) });
    }
    this.squares = [];
    for (const k of ['w', 'b']) {
      const m = new THREE.Mesh(mergeGeos(geos[k]), this['matSq' + k.toUpperCase()]);
      m.receiveShadow = true;
      this.boardGroup.add(m);
    }
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const p = this.posOf(f, r);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(p.x, 0, p.z);
      hit.userData.sq = (7 - r) * 8 + f;
      this.boardGroup.add(hit);
      this.squares.push(hit);
    }
    // рамка доски — тёмный кант
    const rimM = M(0x3a2d20);
    const rim = mergeGeos([
      { geo: new THREE.BoxGeometry(8.5, 0.1, 0.35), matrix: trs(0, -0.06, 4.14, 0) },
      { geo: new THREE.BoxGeometry(8.5, 0.1, 0.35), matrix: trs(0, -0.06, -4.14, 0) },
      { geo: new THREE.BoxGeometry(0.35, 0.1, 8.5), matrix: trs(4.14, -0.06, 0, 0) },
      { geo: new THREE.BoxGeometry(0.35, 0.1, 8.5), matrix: trs(-4.14, -0.06, 0, 0) },
      { geo: new THREE.BoxGeometry(8.5, 0.14, 8.5), matrix: trs(0, -0.16, 0, 0) }
    ]);
    const rimMesh = new THREE.Mesh(rim, rimM);
    rimMesh.receiveShadow = true;
    this.boardGroup.add(rimMesh);

    this.pieceProto = null;          // появятся после загрузки GLB
    this._pendingSt = null;          // состояние, пришедшее до загрузки
    this.pieceMeshes = new Map();

    this.hlSel = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 0.98), new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9 }));
    this.hlSel.visible = false; this.boardGroup.add(this.hlSel);
    this.hlLast = [];
    this.dots = [];
    this.hlCheck = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 0.98), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.85 }));
    this.hlCheck.visible = false; this.boardGroup.add(this.hlCheck);
  },

  /* ---- загрузка скульптурных GLB-фигур ---- */
  _loadPieces() {
    if (typeof THREE.GLTFLoader === 'undefined') { this.pieceProto = this._pieceGeos(); return; }
    const loader = new THREE.GLTFLoader();
    const files = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };
    // целевые высоты (в клетках)
    const H = { p: 0.92, n: 1.5, b: 1.62, r: 1.28, q: 1.85, k: 2.05 };
    const keys = Object.keys(files);
    let left = keys.length;
    const protos = {};
    let failed = 0;
    for (const t of keys) {
      loader.load('assets/pieces/' + files[t] + '.glb', (gltf) => {
        try {
          const root = gltf.scene || gltf.scenes[0];
          root.updateMatrixWorld(true);
          // запекаем трансформации узлов в геометрию
          const parts = [];
          root.traverse((o) => {
            if (o.isMesh && o.geometry) {
              const g = o.geometry.clone();
              g.applyMatrix4(o.matrixWorld);
              parts.push({ geo: g, matrix: trs(0, 0, 0, 0) });
            }
          });
          if (!parts.length) throw new Error('no meshes');
          const merged = mergeGeos(parts);
          merged.computeBoundingBox();
          const bb = merged.boundingBox;
          const h = bb.max.y - bb.min.y;
          const s = H[t] / h;
          merged.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
          merged.scale(s, s, s);
          merged.computeVertexNormals();
          protos[t] = merged;
        } catch (e) { failed++; }
        if (--left === 0) this._protosReady(protos, failed >= keys.length);
      }, undefined, () => {
        failed++;
        if (--left === 0) this._protosReady(protos, true);
      });
    }
  },

  _protosReady(protos, allFailed) {
    if (allFailed || !Object.keys(protos).length) {
      this.pieceProto = this._pieceGeos();   // фолбэк: lathe
    } else {
      // добираем недостающие типы из фолбэка
      const fb = this._pieceGeos();
      this.pieceProto = Object.assign({}, fb, protos);
    }
    if (this._pendingSt) { const st = this._pendingSt; this._pendingSt = null; this.sync(st); }
  },

  /* ---- фолбэк: точёные фигуры (если GLB недоступны) ---- */
  _lathe(pts) {
    return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 36);
  },

  _pieceGeos() {
    const P = {};
    const T = (g, x, y, z, ry) => ({ geo: g, matrix: trs(x, y, z, ry || 0) });
    const base = this._lathe([[0, 0], [0.34, 0], [0.34, 0.05], [0.30, 0.09], [0.24, 0.12], [0.22, 0.16], [0, 0.16]]);

    P.p = mergeGeos([T(base),
      T(this._lathe([[0, 0.14], [0.20, 0.14], [0.14, 0.22], [0.10, 0.30], [0.085, 0.40], [0.16, 0.46], [0.09, 0.52], [0.085, 0.56], [0, 0.56]])),
      T(new THREE.SphereGeometry(0.16, 22, 16), 0, 0.63, 0)]);

    const rookBody = this._lathe([[0, 0.14], [0.24, 0.14], [0.21, 0.2], [0.185, 0.38], [0.185, 0.52], [0.26, 0.58], [0.26, 0.66], [0.20, 0.66], [0.20, 0.60], [0, 0.60]]);
    const merl = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      merl.push(T(new THREE.BoxGeometry(0.13, 0.12, 0.13), Math.cos(a) * 0.195, 0.70, Math.sin(a) * 0.195, -a));
    }
    P.r = mergeGeos([T(base), T(rookBody), ...merl]);

    const s = new THREE.Shape();
    s.moveTo(-0.14, 0);
    s.quadraticCurveTo(-0.17, 0.26, -0.03, 0.40);
    s.quadraticCurveTo(0.03, 0.46, 0.02, 0.52);
    s.lineTo(-0.05, 0.63);
    s.lineTo(0.04, 0.58);
    s.quadraticCurveTo(0.15, 0.56, 0.24, 0.47);
    s.quadraticCurveTo(0.30, 0.41, 0.24, 0.37);
    s.quadraticCurveTo(0.15, 0.345, 0.10, 0.38);
    s.quadraticCurveTo(0.13, 0.19, 0.11, 0);
    s.closePath();
    const head = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3 });
    head.translate(0, 0.30, -0.075);
    const mane = new THREE.BoxGeometry(0.05, 0.3, 0.12); mane.translate(0, 0.62, -0.05);
    P.n = mergeGeos([T(base),
      T(this._lathe([[0, 0.14], [0.22, 0.14], [0.17, 0.2], [0.15, 0.26], [0.15, 0.30], [0, 0.30]])),
      T(head), T(mane)]);

    P.b = mergeGeos([T(base),
      T(this._lathe([[0, 0.14], [0.22, 0.14], [0.15, 0.22], [0.105, 0.34], [0.09, 0.46], [0.13, 0.52], [0.075, 0.58],
        [0.13, 0.64], [0.15, 0.70], [0.11, 0.76], [0.045, 0.80], [0.05, 0.86], [0, 0.88]])),
      T(new THREE.SphereGeometry(0.055, 14, 10), 0, 0.92, 0)]);

    P.q = mergeGeos([T(base),
      T(this._lathe([[0, 0.14], [0.26, 0.14], [0.17, 0.24], [0.115, 0.40], [0.095, 0.56], [0.085, 0.68],
        [0.16, 0.76], [0.19, 0.82], [0.13, 0.84], [0, 0.84]])),
      ...[0, 1, 2, 3, 4].map(i => {
        const a = i / 5 * Math.PI * 2;
        return T(new THREE.SphereGeometry(0.045, 12, 10), Math.cos(a) * 0.15, 0.89, Math.sin(a) * 0.15);
      }),
      T(new THREE.SphereGeometry(0.075, 16, 12), 0, 0.93, 0)]);

    P.k = mergeGeos([T(base),
      T(this._lathe([[0, 0.14], [0.27, 0.14], [0.18, 0.24], [0.125, 0.42], [0.10, 0.60], [0.09, 0.72],
        [0.17, 0.80], [0.19, 0.86], [0.12, 0.88], [0, 0.88]])),
      T(new THREE.BoxGeometry(0.07, 0.22, 0.07), 0, 1.0, 0),
      T(new THREE.BoxGeometry(0.19, 0.07, 0.07), 0, 1.02, 0)]);

    return P;
  },

  /* синхронизация фигур с состоянием Chess */
  sync(st) {
    if (!this.pieceProto) { this._pendingSt = st; return; }
    const seen = new Set();
    for (let i = 0; i < 64; i++) {
      const p = st.b[i];
      if (!p) continue;
      seen.add(i);
      let mesh = this.pieceMeshes.get(i);
      if (mesh && mesh.userData.pt !== p.t) {
        this.boardGroup.remove(mesh); this.pieceMeshes.delete(i); mesh = null;
      }
      if (!mesh) {
        mesh = new THREE.Mesh(this.pieceProto[p.t], p.c === 'w' ? this.matW : this.matB);
        mesh.userData.sq = i;
        mesh.userData.pt = p.t;
        mesh.castShadow = true;
        this.boardGroup.add(mesh);
        this.pieceMeshes.set(i, mesh);
        const f = Chess.fileOf(i), r = Chess.rOf(i), pos = this.posOf(f, r);
        mesh.position.set(pos.x, 0.07, pos.z);
      }
      if (mesh.geometry !== this.pieceProto[p.t]) mesh.geometry = this.pieceProto[p.t];
      // конь смотрит на соперника
      if (p.t === 'n') mesh.rotation.y = p.c === 'w' ? Math.PI : 0;
    }
    for (const [sq, mesh] of [...this.pieceMeshes]) {
      if (!seen.has(sq)) { this.boardGroup.remove(mesh); this.pieceMeshes.delete(sq); }
    }
    this.hlCheck.visible = false;
    if (Chess.inCheck(st, st.turn)) {
      const k = st.k[st.turn], f = Chess.fileOf(k), r = Chess.rOf(k), pos = this.posOf(f, r);
      this.hlCheck.position.set(pos.x, 0.012, pos.z);
      this.hlCheck.visible = true;
    }
  },

  select(sq) {
    if (sq == null) { this.hlSel.visible = false; return; }
    const f = Chess.fileOf(sq), r = Chess.rOf(sq), pos = this.posOf(f, r);
    this.hlSel.position.set(pos.x, 0.012, pos.z);
    this.hlSel.visible = true;
  },
  showDots(list, caps) {
    this.clearDots();
    for (const sq of list) {
      const f = Chess.fileOf(sq), r = Chess.rOf(sq), pos = this.posOf(f, r);
      const ring = caps
        ? new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.9, side: THREE.DoubleSide }))
        : new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), new THREE.MeshBasicMaterial({ color: 0x3ddc63, transparent: true, opacity: 0.9 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.015, pos.z);
      ring.userData.sq = sq;
      this.boardGroup.add(ring);
      this.dots.push(ring);
    }
  },
  clearDots() { for (const d of this.dots) this.boardGroup.remove(d); this.dots = []; },
  lastMove(from, to) {
    this.clearLast();
    for (const sq of [from, to]) {
      const f = Chess.fileOf(sq), r = Chess.rOf(sq), pos = this.posOf(f, r);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.015, 0.98), new THREE.MeshBasicMaterial({ color: 0xc9a53e, transparent: true, opacity: 0.55 }));
      m.position.set(pos.x, 0.008, pos.z);
      this.boardGroup.add(m);
      this.hlLast.push(m);
    }
  },
  clearLast() { for (const m of this.hlLast) this.boardGroup.remove(m); this.hlLast = []; },

  flip(toWhiteBottom) {
    this.yaw = toWhiteBottom ? 0 : Math.PI;
    this._camUpdate();
  },

  _camUpdate() {
    this.cam.position.set(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.rad,
      Math.sin(this.pitch) * this.rad,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.rad);
    this.cam.lookAt(0, 0, 0);
  },

  _input(canvas) {
    let down = null;
    canvas.addEventListener('mousedown', e => { down = { x: e.clientX, y: e.clientY, moved: false }; });
    addEventListener('mousemove', e => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) down.moved = true;
      this.yaw -= dx * 0.006;
      this.pitch = clamp(this.pitch + dy * 0.005, 0.25, 1.45);
      down.x = e.clientX; down.y = e.clientY;
      this._camUpdate();
    });
    addEventListener('mouseup', () => down = null);
    canvas.addEventListener('wheel', e => { this.rad = clamp(this.rad + Math.sign(e.deltaY) * 0.9, 5, 24); this._camUpdate(); }, { passive: true });
  },

  pickSquare(clientX, clientY) {
    const r = this.R.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(v, this.cam);
    const pm = rc.intersectObjects([...this.pieceMeshes.values()], false);
    if (pm.length) return pm[0].object.userData.sq;
    const hits = rc.intersectObjects([...this.squares, ...this.dots], false);
    if (hits.length) return hits[0].object.userData.sq;
    return null;
  }
};
