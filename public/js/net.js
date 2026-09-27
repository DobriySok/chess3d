'use strict';
/* ================= NET: мультиплеер без сервера.
   1) Локальные комнаты — BroadcastChannel (два окна одного браузера),
      лобби с автосписком, без единого кода.
   2) P2P по сети — PeerJS (публичный бесплатный брокер сигналинга),
      дальше трафик идёт напрямую между браузерами. ================= */

const Net = {
  mode: null,           // 'local' | 'p2p' | 'hotseat'
  ch: null, lobby: null,
  peer: null, conn: null,
  _cb: null, _lobbyCb: null,
  myRoomId: null, isHost: false,

  /* ---------- единый интерфейс игры ---------- */
  send(obj) {
    if (this.mode === 'local') this.ch && this.ch.readyState !== 'closed' && this.ch.postMessage(obj);
    else if (this.mode === 'p2p') this.conn && this.conn.open && this.conn.send(obj);
    else if (this.mode === 'hotseat') this._cb && this._cb(obj);
  },
  onMsg(cb) { this._cb = cb; },
  _recv(m) { this._cb && this._cb(m); },
  close() {
    if (this.ch) { try { this.ch.close(); } catch (e) {} this.ch = null; }
    if (this.conn) { try { this.conn.close(); } catch (e) {} this.conn = null; }
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
    this.stopLobby();
    this.mode = null; this.myRoomId = null;
  },

  /* ================= ЛОКАЛЬНЫЙ ЛОББИ ================= */
  startLobby(onList) {
    this._lobbyCb = onList;
    if (!this.lobby) {
      this.lobby = new BroadcastChannel('chess-lobby');
      this.lobby.onmessage = e => this._lobbyMsg(e.data);
    }
    this._rooms = new Map();
    this.lobby.postMessage({ t: 'query' });
  },
  stopLobby() { this._lobbyCb = null; this._rooms = null; },

  _lobbyMsg(m) {
    if (!this._rooms) return;
    if (m.t === 'query') { this._announce(); return; }
    if (m.t === 'room') {
      if (m.id === this.myRoomId) return;              // свою не показываем
      this._rooms.set(m.id, { ...m, open: m.open !== false });
    } else if (m.t === 'room-gone') {
      this._rooms.delete(m.id);
    }
    this._emitRooms();
  },
  _announce() {
    if (this._hostInfo) this.lobby.postMessage({ t: 'room', ...this._hostInfo });
  },
  _emitRooms() {
    this._lobbyCb && this._lobbyCb([...this._rooms.values()].filter(r => r.open));
  },

  /* хост объявляет комнату в лобби */
  hostLocal(room, onMsg) {
    this.close();
    this.mode = 'local'; this.isHost = true;
    const id = 'r' + Math.random().toString(36).slice(2, 7);
    this.myRoomId = id;
    this._hostInfo = { id, name: room.name, tc: room.tc, host: App.nick() };
    this.ch = new BroadcastChannel('chess-' + id);
    this.ch.onmessage = e => this._recv(e.data);
    this.startLobby(this._lobbyCb);                    // продолжаем слушать лобби
    this._announce();
    onMsg && setTimeout(onMsg, 0);
    return id;
  },
  /* список комнат (для перерисовки) */
  localRooms() { return this._rooms ? [...this._rooms.values()].filter(r => r.open) : []; },
  joinLocal(id, onMsg) {
    const info = this._rooms && this._rooms.get(id);
    this.close();
    this.mode = 'local'; this.isHost = false;
    this.myRoomId = 'join_' + id;
    this.ch = new BroadcastChannel('chess-' + id);
    this.ch.onmessage = e => this._recv(e.data);
    this.ch.postMessage({ t: 'hello', nick: App.nick() });
    return info || {};
  },
  roomGone() {
    if (this._hostInfo && this.lobby) this.lobby.postMessage({ t: 'room-gone', id: this._hostInfo.id });
    this._hostInfo = null;
  },

  /* ================= P2P (PeerJS) ================= */
  hostP2P(onCode, onMsg, onErr) {
    this.close();
    this.mode = 'p2p'; this.isHost = true;
    const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');
    this.myRoomId = code;
    const peer = this.peer = new Peer('lsch-' + code);
    peer.on('open', () => onCode(code));
    peer.on('error', e => { onErr && onErr('Брокер недоступен: ' + (e.type || e.message)); this.close(); });
    peer.on('connection', c => {
      if (this.conn) { try { c.close(); } catch (e) {} return; }
      this.conn = c;
      c.on('open', () => onMsg && onMsg('open'));
      c.on('data', d => this._recv(d));
      c.on('close', () => { this._recv({ t: 'bye' }); });
    });
    return code;
  },
  joinP2P(code, onMsg, onErr) {
    this.close();
    this.mode = 'p2p'; this.isHost = false;
    const peer = this.peer = new Peer();
    peer.on('open', () => {
      const c = this.conn = peer.connect('lsch-' + code, { reliable: true });
      c.on('open', () => onMsg && onMsg('open'));
      c.on('data', d => this._recv(d));
      c.on('error', e => onErr && onErr('Не подключилось: ' + (e.type || e)));
      peer.on('error', e => onErr && onErr('Код не найден или брокер недоступен'));
    });
    peer.on('error', e => { onErr && onErr('Брокер недоступен: ' + (e.type || e.message)); });
  }
};
