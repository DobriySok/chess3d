'use strict';
/* ================= 3D: доска-кубики над облаками.
   Фигуры — точёные (LatheGeometry), конь — экструзия профиля головы.
   Небо-градиент, дрейфующие облака под доской, мягкие тени, лёгкое покачивание. ================= */

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
    this.scene.fog = new THREE.Fog(0xe8f2fb, 26, 70);

    this.cam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200);
    this.yaw = 0; this.pitch = 0.9; this.rad = 11;
    this._camUpdate();

    this.scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x8fa3bd, 0.95));
    const d = new THREE.DirectionalLight(0xfff4e0, 1.0);
    d.position.set(7, 14, 5);
    d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048);
    d.shadow.camera.left = -7; d.shadow.camera.right = 7;
    d.shadow.camera.top = 7; d.shadow.camera.bottom = -7;
    d.shadow.camera.near = 2; d.shadow.camera.far = 40;
    d.shadow.bias = -0.0004;
    this.scene.add(d);
    const fill = new THREE.DirectionalLight(0xcfe2ff, 0.25);
    fill.position.set(-6, 8, -4);
    this.scene.add(fill);

    // группа доски (всё, что покачивается вместе)
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    this._build();
    this._clouds();
    this._input(canvas);

    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;
      // покачивание доски над облаками
      this.boardGroup.position.y = Math.sin(t * 0.7) * 0.05;
      this.boardGroup.rotation.z = Math.sin(t * 0.5) * 0.004;
      // дрейф облаков
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

  _sky() {
    const c = document.createElement('canvas'); c.width = 2; c.height = 512;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#3f8fd6');
    g.addColorStop(0.45, '#7fbcee');
    g.addColorStop(0.75, '#c3e0f5');
    g.addColorStop(1, '#e8f2fb');
    x.fillStyle = g; x.fillRect(0, 0, 2, 512);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    this.scene.background = t;
  },

  _cloudTex() {
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

  _clouds() {
    const tex = this._cloudTex();
    this.clouds = [];
    const mk = (x, y, z, s, op, v) => {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z);
      sp.scale.set(s, s * 0.55, 1);
      sp.userData = { v, bound: 42 };
      this.scene.add(sp);
      this.clouds.push(sp);
    };
    // ближнее «основание» из облаков прямо под доской
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.6;
      const r = 4.5 + Math.random() * 3.5;
      mk(Math.cos(a) * r, -1.6 - Math.random() * 0.7, Math.sin(a) * r, 5 + Math.random() * 3, 0.9, 0.12 + Math.random() * 0.1);
    }
    // дальние слои
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 24;
      mk(Math.cos(a) * r, -5 + Math.random() * 6, Math.sin(a) * r, 8 + Math.random() * 12, 0.55 + Math.random() * 0.35, 0.2 + Math.random() * 0.5);
    }
    // высокие облака вдали
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      mk(Math.cos(a) * 40, 3 + Math.random() * 5, Math.sin(a) * 40, 16 + Math.random() * 10, 0.4, 0.5 + Math.random() * 0.4);
    }
  },

  _build() {
    const M = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.matW = new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.4, metalness: 0.05 });
    this.matB = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.5, metalness: 0.08 });
    this.matSqW = M(0xe8e8e4); this.matSqB = M(0x3a4048);

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
    const rimM = M(0x2c313a);
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

    this.pieceProto = this._pieceGeos();
    this.pieceMeshes = new Map();

    this.hlSel = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 0.98), new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9 }));
    this.hlSel.visible = false; this.boardGroup.add(this.hlSel);
    this.hlLast = [];
    this.dots = [];
    this.hlCheck = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 0.98), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.85 }));
    this.hlCheck.visible = false; this.boardGroup.add(this.hlCheck);
  },

  _lathe(pts) {
    return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 36);
  },

  _pieceGeos() {
    const P = {};
    const mg = list => mergeGeos(list);
    const T = (g, x, y, z, ry) => ({ geo: g, matrix: trs(x, y, z, ry || 0) });

    // общая база: широкий диск + галтель
    const base = this._lathe([[0, 0], [0.34, 0], [0.34, 0.05], [0.30, 0.09], [0.24, 0.12], [0.22, 0.16], [0, 0.16]]);

    // ПЕШКА
    P.p = mg([T(base),
      T(this._lathe([[0, 0.14], [0.20, 0.14], [0.14, 0.22], [0.10, 0.30], [0.085, 0.40], [0.16, 0.46], [0.09, 0.52], [0.085, 0.56], [0, 0.56]])),
      T(new THREE.SphereGeometry(0.16, 22, 16), 0, 0.63, 0)]);

    // ЛАДЬЯ
    const rookBody = this._lathe([[0, 0.14], [0.24, 0.14], [0.21, 0.2], [0.185, 0.38], [0.185, 0.52], [0.26, 0.58], [0.26, 0.66], [0.20, 0.66], [0.20, 0.60], [0, 0.60]]);
    const merl = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      merl.push(T(new THREE.BoxGeometry(0.13, 0.12, 0.13), Math.cos(a) * 0.195, 0.70, Math.sin(a) * 0.195, -a));
    }
    P.r = mg([T(base), T(rookBody), ...merl]);

    // КОНЬ: база + экструдированный профиль головы
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
    // грива: тонкая пластина по затылку
    const mane = new THREE.BoxGeometry(0.05, 0.3, 0.12); mane.translate(0, 0.62, -0.05);
    P.n = mg([T(base),
      T(this._lathe([[0, 0.14], [0.22, 0.14], [0.17, 0.2], [0.15, 0.26], [0.15, 0.30], [0, 0.30]])),
      T(head), T(mane)]);

    // СЛОН
    P.b = mg([T(base),
      T(this._lathe([[0, 0.14], [0.22, 0.14], [0.15, 0.22], [0.105, 0.34], [0.09, 0.46], [0.13, 0.52], [0.075, 0.58],
        [0.13, 0.64], [0.15, 0.70], [0.11, 0.76], [0.045, 0.80], [0.05, 0.86], [0, 0.88]])),
      T(new THREE.SphereGeometry(0.055, 14, 10), 0, 0.92, 0)]);

    // ФЕРЗЬ
    P.q = mg([T(base),
      T(this._lathe([[0, 0.14], [0.26, 0.14], [0.17, 0.24], [0.115, 0.40], [0.095, 0.56], [0.085, 0.68],
        [0.16, 0.76], [0.19, 0.82], [0.13, 0.84], [0, 0.84]])),
      ...[0, 1, 2, 3, 4].map(i => {
        const a = i / 5 * Math.PI * 2;
        return T(new THREE.SphereGeometry(0.045, 12, 10), Math.cos(a) * 0.15, 0.89, Math.sin(a) * 0.15);
      }),
      T(new THREE.SphereGeometry(0.075, 16, 12), 0, 0.93, 0)]);

    // КОРОЛЬ
    P.k = mg([T(base),
      T(this._lathe([[0, 0.14], [0.27, 0.14], [0.18, 0.24], [0.125, 0.42], [0.10, 0.60], [0.09, 0.72],
        [0.17, 0.80], [0.19, 0.86], [0.12, 0.88], [0, 0.88]])),
      T(new THREE.BoxGeometry(0.07, 0.22, 0.07), 0, 1.0, 0),
      T(new THREE.BoxGeometry(0.19, 0.07, 0.07), 0, 1.02, 0)]);

    return P;
  },

  /* синхронизация фигур с состоянием Chess */
  sync(st) {
    const seen = new Set();
    for (let i = 0; i < 64; i++) {
      const p = st.b[i];
      if (!p) continue;
      seen.add(i);
      let mesh = this.pieceMeshes.get(i);
      if (!mesh) {
        mesh = new THREE.Mesh(this.pieceProto[p.t], p.c === 'w' ? this.matW : this.matB);
        mesh.userData.sq = i;
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
    canvas.addEventListener('wheel', e => { this.rad = clamp(this.rad + Math.sign(e.deltaY) * 0.9, 5, 22); this._camUpdate(); }, { passive: true });
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
