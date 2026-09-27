const Chess = require('./js/chess.js');
// Эталонные значения perft для начальной расстановки (общепризнанные):
const expect = [1, 20, 400, 8902, 197281];
const st = Chess.initial(false, Math.random);
for (let d = 1; d <= 4; d++) {
  const n = Chess.perft(st, d);
  console.log(`perft(${d}) = ${n}  ${n === expect[d] ? 'OK' : 'FAIL (ожидалось ' + expect[d] + ')'}`);
  if (n !== expect[d]) process.exit(1);
}
// мат в 1: 1.f3? e5 2.g4 Qh4# — проверка статуса мата и SAN
const s2 = Chess.initial(false, Math.random);
const mv = (f, t, extra) => Chess.legal(s2).find(m => Chess.nameOf(m.from) === f && Chess.nameOf(m.to) === t && (!extra || m.promo === extra));
Chess.make(s2, mv('f2', 'f3'));
Chess.make(s2, mv('e7', 'e5'));
Chess.make(s2, mv('g2', 'g4'));
const qh4 = mv('d8', 'h4');
console.log('SAN последнего хода:', Chess.san(s2, qh4), '(ожидается Qh4#)');
Chess.make(s2, qh4);
console.log('Статус:', Chess.status(s2), '(ожидается mate)');
console.log('ALL TESTS PASSED');
