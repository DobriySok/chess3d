'use strict';
/* ================= APP: экраны, лобби, игровой поток, часы ================= */

const TC = {
  none: { label: 'Без часов', base: 0 },
  bullet: { label: 'Пуля 1+0', base: 60 },
  blitz: { label: 'Блиц 3+0', base: 180 },
  rapid: { label: 'Рапид 10 мин', base: 600 }
};

const App = {
  st: null, myColor: 'w', tcKey: 'blitz',
  clock: { w: 0, b: 0, run: false, last: 0 },
  sel: null, myTurn: false, busy: false,
  ended: false, roomName: '', peerReady: false,

  nick() {
    let n = localStorage.getItem('ch_nick');
    if (!n) { n = 'Игрок' + (100 + (Math.random() * 900 | 0)); localStorage.setItem('ch_nick', n); }
    return n;
  },

  boot() {
    Scene3D.init(document.getElementById('gl'));
    const $ = s => document.querySelector(s);
    const show = id => { for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden'); $(id).classList.remove('hidden'); };
    this.show = show;

    $('#btn-local-lobby').onclick = () => { show('#scr-lobby'); this.lobbyLoop(); };
    $('#btn-hotseat').onclick = () => this.startHotseat();
    $('#btn-p2p').onclick = () => {
      show('#scr-p2p');
      if (typeof Peer === 'undefined') $('#p2p-status').textContent = 'PeerJS не загрузился (нужен интернет)';
    };
    document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { Net.stopLobby(); Net.roomGone(); Net.close(); show('#scr-menu'); });
    $('#btn-create').onclick = () => this.createLocal();
    $('#btn-p2p-host').onclick = () => this.hostP2P();
    $('#btn-p2p-join').onclick = () => this.joinP2P();
    $('#btn-resign').onclick = () => this.resign();
    $('#btn-exit').onclick = () => this.exitGame();
    $('#btn-go-exit').onclick = () => { $('#gameover').classList.add('hidden'); this.exitGame(); };
    $('#btn-rematch').onclick = () => this.rematch();
    document.querySelectorAll('.promo').forEach(b => b.onclick = () => this.choosePromo(b.dataset.p));

    Net.onMsg(m => this.onNet(m));
    // клик по доске
    const gl = document.getElementById('gl');
    gl.addEventListener('click', e => {
      if (this.busy || this.ended || !this.st) return;
      const sq = Scene3D.pickSquare(e.clientX, e.clientY);
      if (sq == null) return;
      this.onSquare(sq);
    });
  },

  /* ================= ЛОББИ ================= */
  lobbyLoop() {
    Net.startLobby(() => this.renderRooms());
    this.renderRooms();
    clearInterval(this._li);
    this._li = setInterval(() => this.renderRooms(), 1500);
  },
  renderRooms() {
    const list = document.getElementById('room-list');
    const rooms = Net.localRooms();
    if (!rooms.length) {
      list.innerHTML = '<div class="hint">Пока пусто. Создай комнату — она появится в списке во втором окне этого браузера.</div>';
      return;
    }
    list.innerHTML = '';
    for (const r of rooms) {
      const d = document.createElement('div');
      d.className = 'room';
      d.innerHTML = `<div><div class="nm">${r.name}</div><div class="meta">${TC[r.tc] ? TC[r.tc].label : r.tc} · хост: ${r.host || 'Игрок'} · белыми</div></div><div class="grow"></div>`;
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = 'ВОЙТИ';
      b.onclick = () => this.joinLocal(r);
      d.appendChild(b);
      list.appendChild(d);
    }
  },
  createLocal() {
    const name = document.getElementById('room-name').value || ('Комната ' + this.nick());
    const tc = document.getElementById('room-tc').value;
    this.tcKey = tc;
    this.myColor = 'w';
    this.roomName = name;
    Net.hostLocal({ name, tc }, () => {});
    this._waitOpponent('Комната создана. Ждём соперника во втором окне…');
  },
  joinLocal(info) {
    this.tcKey = info.tc || 'blitz';
    this.myColor = 'b';
    this.roomName = info.name || 'Комната';
    clearInterval(this._li);
    Net.joinLocal(info.id, () => {});
    this._waitOpponent('Подключились. Ждём начала…');
  },
  _waitOpponent(msg) {
    this.show('#scr-game');
    document.getElementById('game-msg').textContent = msg;
    document.getElementById('topbar').style.opacity = .5;
  },

  /* ================= P2P ================= */
  hostP2P() {
    const st = document.getElementById('p2p-status');
    const codeEl = document.getElementById('p2p-code');
    st.textContent = 'Создаём комнату…';
    codeEl.classList.add('hidden');
    if (typeof Peer === 'undefined') { st.textContent = 'PeerJS не загрузился (нужен интернет).'; return; }
    this.tcKey = document.getElementById('room-tc') ? 'blitz' : 'blitz';
    Net.hostP2P(code => {
      codeEl.textContent = code;
      codeEl.classList.remove('hidden');
      st.textContent = 'Соперник вводит этот код на другом устройстве…';
    }, ev => {
      if (ev === 'open') { this.myColor = 'w'; this.roomName = 'P2P'; this._beginMulti(); }
    }, err => st.textContent = err);
  },
  joinP2P() {
    const code = document.getElementById('p2p-join-code').value.trim().toUpperCase();
    const st = document.getElementById('p2p-status');
    if (code.length < 4) { st.textContent = 'Введи код комнаты'; return; }
    if (typeof Peer === 'undefined') { st.textContent = 'PeerJS не загрузился (нужен интернет).'; return; }
    st.textContent = 'Подключаемся…';
    Net.joinP2P(code, ev => {
      if (ev === 'open') { this.myColor = 'b'; this.roomName = 'P2P'; this._beginMulti(); }
    }, err => st.textContent = err);
  },

  /* ================= Хотсит ================= */
  startHotseat() {
    Net.close();
    Net.mode = 'hotseat';
    this.myColor = 'both';
    this.tcKey = 'none';
    this.roomName = 'Хотсит';
    this._initGame(true);
    this._msg('Ход белых');
  },

  /* ================= Начало партии ================= */
  _beginMulti() {
    if (Net.isHost) {
      Net.send({ t: 'start', tc: this.tcKey, host: this.nick() });
      this._initGame(true);
    }
    // гость начнёт при получении 'start'
  },

  _initGame(runClocks) {
    this.st = Chess.initial(false, Math.random);
    this.ended = false; this.sel = null; this.busy = false;
    this.promoResolve = null;
    Scene3D.clearLast(); Scene3D.clearDots(); Scene3D.select(null);
    Scene3D.sync(this.st);
    Scene3D.flip(this.myColor === 'w' || this.myColor === 'both');
    this.clock = { w: TC[this.tcKey].base * 1000, b: TC[this.tcKey].base * 1000, run: runClocks && this.tcKey !== 'none', last: Date.now() };
    document.getElementById('topbar').style.opacity = 1;
    document.getElementById('inf-me').textContent =
      this.myColor === 'both' ? 'Двое за одним ПК' : 'Вы: ' + (this.myColor === 'w' ? 'БЕЛЫЕ' : 'ЧЁРНЫЕ');
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('promo').classList.add('hidden');
    this._turnUI();
  },

  _turnUI() {
    const t = document.getElementById('inf-turn');
    const my = this.myColor === 'both' || this.st.turn === this.myColor;
    this.myTurn = my && !this.ended;
    t.textContent = this.ended ? '' : (this.st.turn === 'w' ? 'Ход белых' : 'Ход чёрных') + (my && !this.ended ? ' (вы)' : '');
    document.getElementById('clock-w').classList.toggle('act', this.st.turn === 'w' && !this.ended);
    document.getElementById('clock-b').classList.toggle('act', this.st.turn === 'b' && !this.ended);
  },

  _msg(s) { document.getElementById('game-msg').textContent = s; },

  /* ================= Клик по доске ================= */
  onSquare(sq) {
    if (!this.myTurn) return;
    if (this.sel != null) {
      const cand = Chess.legal(this.st, this.sel).filter(m => m.to === sq);
      if (cand.length) {
        if (cand.length > 1 && cand[0].promo) { this._askPromo(cand); return; }
        this.doMove(cand[0]);
        return;
      }
    }
    const p = this.st.b[sq];
    if (p && (this.myColor === 'both' ? true : p.c === this.myColor) && p.c === this.st.turn) {
      this.sel = sq;
      Scene3D.select(sq);
      Scene3D.showDots(Chess.legal(this.st, sq).map(m => m.to), false);
      // подсветим взятия красным
      for (const d of Scene3D.dots) if (this.st.b[d.userData.sq]) {
        d.geometry.dispose(); d.geometry = new THREE.RingGeometry(0.3, 0.42, 24); d.material = new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        d.rotation.x = -Math.PI / 2;
      }
    } else { this.sel = null; Scene3D.select(null); Scene3D.clearDots(); }
  },

  _askPromo(cands) {
    const el = document.getElementById('promo');
    el.classList.remove('hidden');
    this.promoResolve = p => {
      el.classList.add('hidden');
      const mv = cands.find(c => c.promo === p);
      if (mv) this.doMove(mv);
      this.promoResolve = null;
    };
  },
  choosePromo(p) { this.promoResolve && this.promoResolve(p); },

  /* ================= Совершение хода (я) ================= */
  doMove(mv) {
    if (this.busy || this.ended) return;
    this.busy = true;
    const san = Chess.san(this.st, mv);            // san делает make/unmake
    Chess.make(this.st, mv);
    Net.send({ t: 'move', from: mv.from, to: mv.to, promo: mv.promo || null, san, w: Math.round(this.clock.w), b: Math.round(this.clock.b) });
    this.afterMove(mv, san, true);
    this.busy = false;
  },

  /* ================= Приём сообщения ================= */
  onNet(m) {
    if (!m) return;
    if (m.t === 'hello' && Net.isHost && this.st && !this._started) { /* handshake: сразу старт */ }
    if (m.t === 'hello' && Net.mode === 'local' && Net.isHost) {
      // второе окно подключилось: шлём старт
      Net.send({ t: 'start', tc: this.tcKey, host: this.nick() });
      this._initGame(true);
      this._msg('Соперник подключился. Вы — белые.');
      return;
    }
    if (m.t === 'start') {
      if (Net.mode === 'local' || Net.mode === 'p2p') {
        if (this.myColor === 'b' || !this.st) {
          this.tcKey = TC[m.tc] ? m.tc : 'blitz';
          this._initGame(true);
          this._msg('Вы — чёрные. Ход белых.');
        }
      }
      return;
    }
    if (m.t === 'move') {
      if (!this.st || this.ended) return;
      if (m.from == null || m.to == null) return;
      const cands = Chess.legal(this.st, m.from).filter(x => x.to === m.to && (x.promo || null) === (m.promo || null));
      if (!cands.length) { this._msg('Синхронизация потеряна 😵'); return; }
      Chess.make(this.st, cands[0]);
      if (this.tcKey !== 'none' && m.w != null) { this.clock.w = m.w; this.clock.b = m.b; this.clock.last = Date.now(); }
      this.afterMove(cands[0], m.san, false);
      return;
    }
    if (m.t === 'flag') { if (!this.ended) this._gameOver('time', m.winner, true); return; }
    if (m.t === 'resign') { if (!this.ended) this._gameOver('resign', m.winner, true); return; }
    if (m.t === 'rematch') {
      if (this.myColor !== 'both') { this.myColor = this.myColor === 'w' ? 'b' : 'w'; this._initGame(true); this._msg('Реванш! Вы: ' + (this.myColor === 'w' ? 'белые' : 'чёрные')); }
      return;
    }
    if (m.t === 'bye') { if (!this.ended) { this._msg('Соперник отключился'); } }
  },

  /* ================= После хода ================= */
  afterMove(mv, san, mine) {
    this.sel = null;
    Scene3D.select(null);
    Scene3D.clearDots();
    Scene3D.sync(this.st);
    Scene3D.lastMove(mv.from, mv.to);
    Audio.click(mv.to != null && !!this.st.b[mv.to]);
    const status = Chess.status(this.st);
    this._turnUI();
    if (status === 'playing') { this._msg(san); return; }
    let type, winner;
    if (status === 'mate') { type = 'mate'; winner = this.st.turn === 'w' ? 'b' : 'w'; }
    else if (status === 'stalemate') type = 'stalemate';
    else if (status === '50') type = '50';
    else type = 'material';
    this._gameOver(type, winner, false, san);
  },

  _gameOver(type, winner, remote, lastSan) {
    this.ended = true;
    this.myTurn = false;
    Scene3D.clearDots(); Scene3D.select(null);
    const titles = {
      mate: 'МАТ! Победили ' + (winner === 'w' ? 'белые' : 'чёрные'),
      stalemate: 'ПАТ — ничья',
      '50': 'Ничья: 50 ходов без взятий',
      material: 'Ничья: недостаточно материала',
      time: 'ВРЕМЯ! Победили ' + (winner === 'w' ? 'белые' : 'чёрные'),
      resign: (remote ? 'Соперник сдался. ' : 'Вы сдались. ') + 'Победили ' + (winner === 'w' ? 'белые' : 'чёрные')
    };
    const mine = this.myColor === 'both' ? null : winner === this.myColor;
    document.getElementById('go-title').textContent = titles[type] + (mine == null ? '' : mine ? ' 🎉' : ' 😤');
    document.getElementById('gameover').classList.remove('hidden');
    this._msg(lastSan || '');
    document.getElementById('clock-w').classList.remove('act');
    document.getElementById('clock-b').classList.remove('act');
  },

  resign() {
    if (this.ended || this.myColor === 'both') { this.exitGame(); return; }
    const winner = this.myColor === 'w' ? 'b' : 'w';
    Net.send({ t: 'resign', winner });
    this._gameOver('resign', winner, false);
  },
  rematch() {
    if (this.myColor === 'both') { this._initGame(true); this._msg('Ход белых'); return; }
    Net.send({ t: 'rematch' });
    this.myColor = this.myColor === 'w' ? 'b' : 'w';
    this._initGame(true);
    this._msg('Реванш! Вы: ' + (this.myColor === 'w' ? 'белые' : 'чёрные'));
  },
  exitGame() {
    Net.roomGone();
    Net.close();
    this.st = null; this.ended = true;
    clearInterval(this._li); clearInterval(this._ck);
    document.getElementById('gameover').classList.add('hidden');
    this.show('#scr-menu');
  },

  /* ================= Часы ================= */
  tickClocks() {
    if (!this.st || this.ended || !this.clock.run) return;
    const now = Date.now();
    const el = now - (this.clock.last || now);
    this.clock.last = now;
    if (this.st.turn === 'w') this.clock.w -= el; else this.clock.b -= el;
    if (this.clock.w <= 0) { this.clock.w = 0; const win = 'b'; Net.send({ t: 'flag', winner: win }); this._gameOver('time', win, false); }
    else if (this.clock.b <= 0) { this.clock.b = 0; const win = 'w'; Net.send({ t: 'flag', winner: win }); this._gameOver('time', win, false); }
    const fmt = ms => {
      ms = Math.max(0, ms);
      const s = Math.ceil(ms / 1000);
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    };
    const cw = document.getElementById('clock-w'), cb = document.getElementById('clock-b');
    cw.textContent = fmt(this.clock.w); cb.textContent = fmt(this.clock.b);
    cw.classList.toggle('low', this.clock.w < 20000);
    cb.classList.toggle('low', this.clock.b < 20000);
  }
};

/* звук */
const Audio = {
  ctx: null,
  click(cap) {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.value = cap ? 180 : 420; o.type = cap ? 'sine' : 'triangle';
      g.gain.setValueAtTime(0.15, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }
};

setInterval(() => App.tickClocks(), 100);
App.boot();
