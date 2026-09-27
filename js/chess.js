'use strict';
/* ================= ШАХМАТНЫЙ ДВИЖОК: полные правила, make/unmake.
   Индексация: 0 = a8 (левый верхний у белых), 63 = h1.
   Файл = i % 8 (a=0), горизонталь от белых rB = 7 - (i >> 3) (1-я = 0). ================= */
const Chess = (() => {

  const FILE = 'abcdefgh';
  const inside = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
  const sqOf = (f, r) => (7 - r) * 8 + f;          // r = горизонталь от 1-й
  const fileOf = i => i % 8;
  const rOf = i => 7 - (i >> 3);                    // "1".."8" как 0..7
  const nameOf = i => FILE[fileOf(i)] + (rOf(i) + 1);

  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  function initial(n60, rng) {
    const b = new Array(64).fill(null);
    // пешки
    for (let f = 0; f < 8; f++) { b[sqOf(f, 1)] = { c: 'w', t: 'p' }; b[sqOf(f, 6)] = { c: 'b', t: 'p' }; }
    let back;
    if (!n60) back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    else {
      // Chess960: слоны на разных цветах, король между ладьями
      back = new Array(8).fill(null);
      const rb = (rng) => rng();
      let r1 = Math.floor(rng() * 4) * 2, r2 = Math.floor(rng() * 4) * 2 + 1;
      back[r1] = 'b'; back[r2] = 'b';
      const free = [...Array(8).keys()].filter(i => back[i] === null);
      const q = free[Math.floor(rng() * free.length)];
      back[q] = 'q';
      const free2 = [...Array(8).keys()].filter(i => back[i] === null);
      // король между ладьями: выбираем 3 подряд свободных
      const spots = [];
      for (let i = 0; i < free2.length - 2; i++)
        if (free2[i + 1] === free2[i] + 1 && free2[i + 2] === free2[i] + 2) spots.push(free2[i]);
      const s = spots[Math.floor(rng() * spots.length)];
      back[s] = 'r'; back[s + 2] = 'r'; back[s + 1] = 'k';
      const free3 = [...Array(8).keys()].filter(i => back[i] === null);
      free3.forEach(i => back[i] = 'n');
    }
    back.forEach((t, f) => { b[sqOf(f, 0)] = { c: 'w', t }; b[sqOf(f, 7)] = { c: 'b', t }; });
    const kF = back.indexOf('k'), rKF = back.lastIndexOf('r'), rQF = back.indexOf('r');
    const st = {
      b, turn: 'w',
      cr: { wK: true, wQ: true, bK: true, bQ: true },
      rw: { wk: kF, rK: rKF, rQ: rQF, bk: kF, brK: rKF, brQ: rQF },
      ep: -1, hm: 0, fm: 1, n60: !!n60,
      k: { w: sqOf(kF, 0), b: sqOf(kF, 7) }
    };
    return st;
  }

  function clone(st) {
    return {
      b: st.b.map(p => p ? { c: p.c, t: p.t } : null), turn: st.turn,
      cr: { ...st.cr }, rw: { ...st.rw }, ep: st.ep, hm: st.hm, fm: st.fm, n60: st.n60,
      k: { ...st.k }
    };
  }

  const DIRS = { n: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
    b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
  DIRS.q = DIRS.b.concat(DIRS.r);

  /* атакована ли клетка i стороной by */
  function attacked(st, i, by) {
    const f = fileOf(i), r = rOf(i);
    // пешки
    const pd = by === 'w' ? 1 : -1;   // пешка by стоит на r - pd и бьёт на r
    for (const df of [-1, 1]) {
      const ff = f + df, rr = r - pd;
      if (inside(ff, rr)) { const p = st.b[sqOf(ff, rr)]; if (p && p.c === by && p.t === 'p') return true; }
    }
    // кони
    for (const [df, dr] of DIRS.n) {
      const ff = f + df, rr = r + dr;
      if (inside(ff, rr)) { const p = st.b[sqOf(ff, rr)]; if (p && p.c === by && p.t === 'n') return true; }
    }
    // король
    for (const [df, dr] of DIRS.q) {
      const ff = f + df, rr = r + dr;
      if (inside(ff, rr)) { const p = st.b[sqOf(ff, rr)]; if (p && p.c === by && p.t === 'k') return true; }
    }
    // лучи
    for (const [df, dr] of DIRS.b) {
      let ff = f + df, rr = r + dr;
      while (inside(ff, rr)) {
        const p = st.b[sqOf(ff, rr)];
        if (p) { if (p.c === by && (p.t === 'b' || p.t === 'q')) return true; break; }
        ff += df; rr += dr;
      }
    }
    for (const [df, dr] of DIRS.r) {
      let ff = f + df, rr = r + dr;
      while (inside(ff, rr)) {
        const p = st.b[sqOf(ff, rr)];
        if (p) { if (p.c === by && (p.t === 'r' || p.t === 'q')) return true; break; }
        ff += df; rr += dr;
      }
    }
    return false;
  }

  const inCheck = (st, c) => attacked(st, st.k[c], c === 'w' ? 'b' : 'w');

  /* псевдоходы (без проверки шаха своему королю) */
  function pseudo(st, c, from) {
    const out = [];
    const add = (from, to, extra) => out.push({ from, to, ...extra });
    const one = (f, r, df, dr, t) => {
      const ff = f + df, rr = r + dr;
      if (!inside(ff, rr)) return false;
      const to = sqOf(ff, rr), p = st.b[to];
      if (!p) { add(from, to, {}); return true; }
      if (p.c !== c) add(from, to, {});
      return false;
    };
    if (from == null) {
      for (let i = 0; i < 64; i++) {
        const p = st.b[i];
        if (p && p.c === c) out.push(...pseudo(st, c, i));
      }
      return out;
    }
    const p = st.b[from];
    if (!p || p.c !== c) return out;
    const f = fileOf(from), r = rOf(from), t = p.t;

    if (t === 'p') {
      const d = c === 'w' ? 1 : -1;          // направление по горизонтали
      const startR = c === 'w' ? 1 : 6, lastR = c === 'w' ? 7 : 0;
      // вперёд
      if (inside(f, r + d) && !st.b[sqOf(f, r + d)]) {
        if (r + d === lastR) for (const pr of ['q', 'r', 'b', 'n']) add(from, sqOf(f, r + d), { promo: pr });
        else {
          add(from, sqOf(f, r + d), {});
          if (r === startR && !st.b[sqOf(f, r + 2 * d)]) add(from, sqOf(f, r + 2 * d), { dbl: true });
        }
      }
      // взятия
      for (const df of [-1, 1]) {
        const ff = f + df, rr = r + d;
        if (!inside(ff, rr)) continue;
        const to = sqOf(ff, rr), tp = st.b[to];
        if (tp && tp.c !== c) {
          if (rr === lastR) for (const pr of ['q', 'r', 'b', 'n']) add(from, to, { promo: pr });
          else add(from, to, {});
        } else if (to === st.ep) add(from, to, { ep: true });
      }
      return out;
    }
    if (t === 'n' || t === 'k') {
      const dirs = t === 'n' ? DIRS.n : DIRS.q;
      for (const [df, dr] of dirs) one(f, r, df, dr);
      // рокировки
      if (t === 'k') {
        const opp = c === 'w' ? 'b' : 'w';
        const home = c === 'w' ? 0 : 7;
        const kF = c === 'w' ? st.rw.wk : st.rw.bk;
        const rKF = c === 'w' ? st.rw.rK : st.rw.brK;
        const rQF = c === 'w' ? st.rw.rQ : st.rw.brQ;
        if (from === sqOf(kF, home) && !inCheck(st, c)) {
          // короткая
          const K = c === 'w' ? st.cr.wK : st.cr.bK;
          if (K && from === sqOf(kF, home)) {
            const gF = 6;
            let clear = true;
            const lo = Math.min(kF, rKF), hi = Math.max(kF, rKF);
            for (let ff = lo + 1; ff < hi; ff++) if (st.b[sqOf(ff, home)]) { clear = false; break; }
            // путь короля (до g) должен быть чист от фигур между k и g (кроме самого короля)
            const lo2 = Math.min(kF + 1, gF), hi2 = Math.max(kF + 1, gF);
            for (let ff = lo2; ff < hi2; ff++) if (st.b[sqOf(ff, home)]) clear = false;
            if (clear) {
              let safe = true;
              const step = gF > kF ? 1 : -1;
              for (let ff = kF; ff !== gF + step; ff += step)
                if (attacked(st, sqOf(ff, home), opp)) { safe = false; break; }
              if (safe) add(from, sqOf(gF, home), { castle: 'K', rookFrom: sqOf(rKF, home), rookTo: sqOf(5, home) });
            }
          }
          // длинная
          const Q = c === 'w' ? st.cr.wQ : st.cr.bQ;
          if (Q) {
            const cF = 2;
            let clear = true;
            const lo = Math.min(kF, rQF), hi = Math.max(kF, rQF);
            for (let ff = lo + 1; ff < hi; ff++) if (st.b[sqOf(ff, home)]) { clear = false; break; }
            const lo2 = Math.min(kF - 1, cF), hi2 = Math.max(kF - 1, cF);
            for (let ff = lo2; ff < hi2; ff++) if (st.b[sqOf(ff, home)]) clear = false;
            if (clear) {
              let safe = true;
              const step = cF > kF ? 1 : -1;
              for (let ff = kF; ff !== cF + step; ff += step)
                if (attacked(st, sqOf(ff, home), opp)) { safe = false; break; }
              if (safe) add(from, sqOf(cF, home), { castle: 'Q', rookFrom: sqOf(rQF, home), rookTo: sqOf(3, home) });
            }
          }
        }
      }
      return out;
    }
    // лучники
    const dirs = t === 'b' ? DIRS.b : t === 'r' ? DIRS.r : DIRS.q;
    for (const [df, dr] of dirs) {
      let ff = f + df, rr = r + dr;
      while (inside(ff, rr)) {
        const to = sqOf(ff, rr), tp = st.b[to];
        if (!tp) add(from, to, {});
        else { if (tp.c !== c) add(from, to, {}); break; }
        ff += df; rr += dr;
      }
    }
    return out;
  }

  /* сделать ход, вернуть undo */
  function make(st, mv) {
    const u = { mv, cr: { ...st.cr }, ep: st.ep, hm: st.hm, cap: null, capSq: -1, wasP: null, rookWas: null };
    const c = st.turn, p = st.b[mv.from];
    u.wasP = p.t;
    st.ep = -1;
    let capSq = mv.to;
    if (mv.ep) { capSq = sqOf(fileOf(mv.to), rOf(mv.from)); }
    if (st.b[capSq]) { u.cap = st.b[capSq]; u.capSq = capSq; st.b[capSq] = null; }
    st.b[mv.to] = mv.promo ? { c, t: mv.promo } : p;
    st.b[mv.from] = null;
    if (u.wasP === 'k') {
      st.k[c] = mv.to;
      if (mv.castle) {
        u.rookWas = { from: mv.rookFrom, to: mv.rookTo, p: st.b[mv.rookFrom] };
        st.b[mv.rookTo] = st.b[mv.rookFrom]; st.b[mv.rookFrom] = null;
      }
      if (c === 'w') { st.cr.wK = false; st.cr.wQ = false; } else { st.cr.bK = false; st.cr.bQ = false; }
    }
    if (u.wasP === 'r') {
      const home = c === 'w' ? 0 : 7;
      if (mv.from === sqOf(st.rw[c === 'w' ? 'rK' : 'brK'], home)) { if (c === 'w') st.cr.wK = false; else st.cr.bK = false; }
      if (mv.from === sqOf(st.rw[c === 'w' ? 'rQ' : 'brQ'], home)) { if (c === 'w') st.cr.wQ = false; else st.cr.bQ = false; }
    }
    // права при взятии ладьи соперника
    if (u.cap && u.cap.t === 'r') {
      const ohome = c === 'w' ? 7 : 0, oc = c === 'w' ? 'b' : 'w';
      if (capSq === sqOf(st.rw[oc === 'w' ? 'rK' : 'brK'], ohome)) { if (oc === 'w') st.cr.wK = false; else st.cr.bK = false; }
      if (capSq === sqOf(st.rw[oc === 'w' ? 'rQ' : 'brQ'], ohome)) { if (oc === 'w') st.cr.wQ = false; else st.cr.bQ = false; }
    }
    if (u.wasP === 'p' && mv.dbl) st.ep = sqOf(fileOf(mv.from), (rOf(mv.from) + rOf(mv.to)) / 2);
    st.hm = (u.wasP === 'p' || u.cap) ? 0 : st.hm + 1;
    if (c === 'b') st.fm++;
    st.turn = c === 'w' ? 'b' : 'w';
    return u;
  }

  function unmake(st, u) {
    const mv = u.mv;
    st.turn = st.turn === 'w' ? 'b' : 'w';
    const c = st.turn;
    if (c === 'b') st.fm--;
    const p = mv.promo ? { c, t: 'p' } : st.b[mv.to];
    st.b[mv.from] = p;
    st.b[mv.to] = null;
    if (u.cap) st.b[u.capSq] = u.cap;
    if (u.rookWas) { st.b[u.rookWas.from] = u.rookWas.p; st.b[u.rookWas.to] = null; }
    if (u.wasP === 'k') st.k[c] = mv.from;
    st.cr = u.cr; st.ep = u.ep; st.hm = u.hm;
  }

  /* все легальные ходы (опционально с клетки) */
  function legal(st, from) {
    const c = st.turn;
    const ps = pseudo(st, c, from);
    const out = [];
    for (const mv of ps) {
      const u = make(st, mv);
      if (!inCheck(st, c)) out.push(mv);
      unmake(st, u);
    }
    return out;
  }

  function status(st) {
    const ms = legal(st);
    if (!ms.length) return inCheck(st, st.turn) ? 'mate' : 'stalemate';
    if (st.hm >= 100) return '50';
    // недостаток материала
    const pieces = st.b.filter(p => p && p.t !== 'p' && p.t !== 'k');
    const pawns = st.b.filter(p => p && p.t === 'p').length;
    if (!pawns && pieces.length === 0) return 'material';
    if (!pawns && pieces.length === 1 && (pieces[0].t === 'n' || pieces[0].t === 'b')) return 'material';
    return 'playing';
  }

  /* SAN с дизамбигуацией и +/# */
  function san(st, mv) {
    const c = st.turn, p = st.b[mv.from];
    let s;
    if (mv.castle) s = mv.castle === 'K' ? 'O-O' : 'O-O-O';
    else {
      const cap = !!st.b[mv.to] || mv.ep;
      if (p.t === 'p') s = (cap ? FILE[fileOf(mv.from)] + 'x' : '') + nameOf(mv.to) + (mv.promo ? '=' + mv.promo.toUpperCase() : '');
      else {
        // дизамбигуация
        let amb = [], sameFile = false, sameRank = false;
        for (let i = 0; i < 64; i++) {
          if (i === mv.from) continue;
          const q = st.b[i];
          if (q && q.c === c && q.t === p.t) {
            if (legal(st, i).some(m => m.to === mv.to)) { amb.push(i); if (fileOf(i) === fileOf(mv.from)) sameFile = true; if (rOf(i) === rOf(mv.from)) sameRank = true; }
          }
        }
        let dis = '';
        if (amb.length) {
          if (!sameFile) dis = FILE[fileOf(mv.from)];
          else if (!sameRank) dis = String(rOf(mv.from) + 1);
          else dis = nameOf(mv.from);
        }
        s = p.t.toUpperCase() + dis + (cap ? 'x' : '') + nameOf(mv.to);
      }
    }
    const u = make(st, mv);
    const st2 = status(st);
    if (st2 === 'mate') s += '#';
    else if (inCheck(st, st.turn)) s += '+';
    unmake(st, u);
    return s;
  }

  function perft(st, d) {
    if (d === 0) return 1;
    let n = 0;
    for (const mv of legal(st)) { const u = make(st, mv); n += perft(st, d - 1); unmake(st, u); }
    return n;
  }

  function loadFrom(flat) {
    // flat: {b:[[c,t]|null x64], turn, cr, ep, n60, rw}
    const st = clone(flat);
    for (let i = 0; i < 64; i++) if (st.b[i]) st.b[i] = { c: st.b[i].c, t: st.b[i].t };
    st.k = { w: st.b.findIndex(p => p && p.t === 'k' && p.c === 'w'), b: st.b.findIndex(p => p && p.t === 'k' && p.c === 'b') };
    return st;
  }

  return { initial, clone, make, unmake, legal, pseudo, attacked, inCheck, status, san, perft, loadFrom, nameOf, fileOf, rOf, FILE, VAL };
})();
if (typeof module !== 'undefined') module.exports = Chess;
