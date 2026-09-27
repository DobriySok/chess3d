'use strict';
/* ================= 3D: доска-кубики (чёрные/белые), простые чёрно-белые фигуры,
   подсветки, орбита камеры мышью. Никакого стола. ================= */

const Scene3D = {
  init(canvas) {
    const R = this.R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    R.outputEncoding = THREE.sRGBEncoding;
    R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.resize(); addEventListener('resize', () => this.resize());
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x151a21);
    this.cam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 100);
    this.yaw = 0; this.pitch = 0.9; this.rad = 11;
    this._camUpdate();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.85));
    const d = new THREE.DirectionalLight(0xffffff, 0.75);
    d.position.set(6, 12, 4);
    this.scene.add(d);

    this._build();
    this._input(canvas);

    const loop = () => { requestAnimationFrame(loop); R.render(this.scene, this.cam); };
    loop();
  },
  resize() { this.R.setSize(innerWidth, innerHeight, false); this.cam && (this.cam.aspect = innerWidth / innerHeight, this.cam.updateProjectionMatrix()); },

  /* квадрат (f,r): f=a..h(0..7), r=1..8(0..7), белые снизу */
  posOf(f, r) { return { x: f - 3.5, z: 3.5 - r }; },

  _build() {
    const M = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.matW = M(0xf0f0f0); this.matB = M(0x16181c);
    this.matSqW = M(0xdfe3e8); this.matSqB = M(0x33383f);
    // --- доска: 64 кубика одним мешем на цвет ---
    const box = new THREE.BoxGeometry(1, 0.14, 1);
    const geos = { w: [], b: [] };
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const p = this.posOf(f, r);
      geos[(f + r) % 2 ? 'w' : 'b'].push({ geo: box, matrix: trs(p.x, -0.07, p.z, 0) });
    }
    this.squares = [];
    const mk = (list, mat) => {
      const m = new THREE.Mesh(mergeGeos(list), mat);
      this.scene.add(m);
      return m;
    };
    mk(geos.w, this.matSqW); mk(geos.b, this.matSqB);
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const p = this.posOf(f, r);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(p.x, 0, p.z);
      hit.userData.sq = (7 - r) * 8 + f;
      this.scene.add(hit);
      this.squares.push(hit);
    }
    // --- фигуры: примитивы ---
    this.pieceProto = this._pieceGeos();
    this.pieceMeshes = new Map();      // sq -> mesh
    // --- подсветки ---
    this.hlSel = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 0.98), new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9 }));
    this.hlSel.visible = false; this.scene.add(this.hlSel);
    this.hlLast = [];
    this.dots = [];
    this.hlCheck = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 0.98), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.85 }));
    this.hlCheck.visible = false; this.scene.add(this.hlCheck);
  },

  _pieceGeos() {
    const cyl = (rt, rb, h, y) => { const g = new THREE.CylinderGeometry(rt, rb, h, 24); g.translate(0, y, 0); return g; };
    const sph = (r, y) => { const g = new THREE.SphereGeometry(r, 20, 14); g.translate(0, y, 0); return g; };
    const box = (w, h, d, y) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y, 0); return g; };
    const P = {};
    const base = (h) => cyl(0.3, 0.34, h, h / 2);
    P.p = mergeGeos([{ geo: base(0.1), matrix: trs(0, 0, 0, 0) }, { geo: cyl(0.15, 0.22, 0.34, 0.27), matrix: trs(0, 0, 0, 0) }, { geo: sph(0.19, 0.58), matrix: trs(0, 0, 0, 0) }]);
    P.r = mergeGeos([{ geo: base(0.1), matrix: trs(0, 0, 0, 0) }, { geo: box(0.42, 0.5, 0.42, 0.35), matrix: trs(0, 0, 0, 0) }, { geo: box(0.52, 0.12, 0.52, 0.66), matrix: trs(0, 0, 0, 0) }]);
    const knight = mergeGeos([{ geo: base(0.1), matrix: trs(0, 0, 0, 0) }, { geo: box(0.36, 0.34, 0.36, 0.27), matrix: trs(0, 0, 0, 0) }]);
    const head = new THREE.BoxGeometry(0.2, 0.55, 0.24); head.translate(0, 0.28, 0.06); head.rotateX(-0.35);
    knight.merge
      ? 0
      : 0;
    const headMerged = mergeGeos([{ geo: head, matrix: trs(0, 0.42, 0, 0) }, { geo: box(0.24, 0.12, 0.3, 0.62), matrix: trs(0, 0, 0, 0) }]);
    P.n = mergeGeos(knight ? [{ geo: knight, matrix: trs(0, 0, 0, 0) }, { geo: headMerged, matrix: trs(0, 0, 0, 0) }] : []);
    P.b = mergeGeos([{ geo: base(0.1), matrix: trs(0, 0, 0, 0) }, { geo: cyl(0.06, 0.26, 0.55, 0.37), matrix: trs(0, 0, 0, 0) }, { geo: sph(0.14, 0.75), matrix: trs(0, 0, 0, 0) }]);
    P.q = mergeGeos([{ geo: base(0.1), matrix: trs(0, 0, 0, 0) }, { geo: cyl(0.06, 0.3, 0.75, 0.47), matrix: trs(0, 0, 0, 0) }, { geo: sph(0.16, 0.98), matrix: trs(0, 0, 0, 0) }]);
    P.k = mergeGeos([{ geo: base(0.1), matrix: trs(0, 0, 0, 0) }, { geo: box(0.34, 0.7, 0.34, 0.45), matrix: trs(0, 0, 0, 0) }, { geo: box(0.1, 0.26, 0.1, 0.93), matrix: trs(0, 0, 0, 0) }, { geo: box(0.26, 0.1, 0.1, 0.95), matrix: trs(0, 0, 0, 0) }]);
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
        // появляется (ход/превращение) — найдём_mesh по совпадению типа ниже; тут просто создаём
        mesh = new THREE.Mesh(this.pieceProto[p.t], p.c === 'w' ? this.matW : this.matB);
        mesh.userData.sq = i;
        this.scene.add(mesh);
        this.pieceMeshes.set(i, mesh);
        const f = Chess.fileOf(i), r = Chess.rOf(i), pos = this.posOf(f, r);
        mesh.position.set(pos.x, 0.07, pos.z);
      }
      // тип мог измениться (превращение)
      if (mesh.geometry !== this.pieceProto[p.t]) { mesh.geometry = this.pieceProto[p.t]; }
    }
    // исчезнувшие — убрать
    for (const [sq, mesh] of [...this.pieceMeshes]) {
      if (!seen.has(sq)) { this.scene.remove(mesh); this.pieceMeshes.delete(sq); }
    }
    // шах королю
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
      this.scene.add(ring);
      this.dots.push(ring);
    }
  },
  clearDots() { for (const d of this.dots) this.scene.remove(d); this.dots = []; },
  lastMove(from, to) {
    this.clearLast();
    for (const sq of [from, to]) {
      const f = Chess.fileOf(sq), r = Chess.rOf(sq), pos = this.posOf(f, r);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.015, 0.98), new THREE.MeshBasicMaterial({ color: 0xc9a53e, transparent: true, opacity: 0.55 }));
      m.position.set(pos.x, 0.008, pos.z);
      this.scene.add(m);
      this.hlLast.push(m);
    }
  },
  clearLast() { for (const m of this.hlLast) this.scene.remove(m); this.hlLast = []; },

  flip(toWhiteBottom) {
    this.yaw = toWhiteBottom ? 0 : Math.PI;
    this._camUpdate();
  },

  _camUpdate() {
    const t = { x: 0, y: 0, z: 0 };
    this.cam.position.set(
      t.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.rad,
      t.y + Math.sin(this.pitch) * this.rad,
      t.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.rad);
    this.cam.lookAt(t.x, 0, t.z);
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
    // сначала фигуры
    const pm = rc.intersectObjects([...this.pieceMeshes.values()], false);
    if (pm.length) return pm[0].object.userData.sq;
    const hits = rc.intersectObjects([...this.squares, ...this.dots], false);
    if (hits.length) return hits[0].object.userData.sq;
    return null;
  }
};
