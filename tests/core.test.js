import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../js/battle.js';
import { ENEMIES, CHAPTERS, validateEnemy } from '../js/data.js';
import { compile, execute, CodeError } from '../js/language.js';
import { runProgram } from '../js/runner.js';
import { ProgramStore } from '../js/storage.js';
const enemy = (pattern, hp = 5) => ({ name: 'テスト', pattern, hp });
const commands = (code, context = {}) => [...execute(compile(code), () => ({ ターン: 1, 敵HP: 5, 記憶: 'なし', ...context }))].filter(e => e.kind === 'action');
const fast = { delay: async () => {} };
test('定義した敵のタメ・詠唱は後続行動を保証する', () => { ENEMIES.forEach(validateEnemy); assert.throws(() => validateEnemy(enemy(['タメ', '攻撃']))); });
test('攻撃は1ダメージでターンが進む', () => { const b = new Battle(enemy(['待機'])); b.perform('攻撃'); assert.equal(b.hp, 4); assert.equal(b.turn, 2); });
test('敵HP0で即勝利し、危険な敵行動も実行しない', () => { const b = new Battle(enemy(['攻撃'], 1)); const l = b.perform('攻撃'); assert.equal(b.status, 'won'); assert.equal(l.enemyAction, '未実行'); });
for (const [action, pattern, alive] of [['防御', ['攻撃'], true], ['回避', ['攻撃'], false], ['防御', ['特技'], true], ['回避', ['特技'], false], ['回避', ['魔法'], true], ['防御', ['魔法'], false]]) {
  test(`${pattern[0]}に${action}：${alive ? '生存' : '死亡'}`, () => { const b = new Battle(enemy(pattern)); b.perform(action); assert.equal(b.status, alive ? 'active' : 'dead'); });
}
test('覚えるは1ターン消費し、記憶を更新・保持する', () => { const b = new Battle(enemy(['詠唱', '魔法', '待機'])); b.perform('覚える'); assert.equal(b.memory, '詠唱'); assert.equal(b.turn, 2); b.perform('回避'); assert.equal(b.memory, '詠唱'); });
test('危険なターンの覚えるは死亡する', () => { const b = new Battle(enemy(['攻撃'])); b.perform('覚える'); assert.equal(b.status, 'dead'); assert.equal(b.memory, '攻撃'); });
test('敵パターンは末尾から先頭へ循環する', () => { const b = new Battle(enemy(['待機', '攻撃'])); b.perform('攻撃'); b.perform('防御'); assert.equal(b.position, 0); assert.equal(b.turn, 3); });
test('RETRYは戦闘を初期化し、累積数を保持する', () => { const b = new Battle(enemy(['待機', '攻撃'])); b.perform('覚える'); b.perform('攻撃'); b.retry(); assert.equal(b.hp, 5); assert.equal(b.turn, 1); assert.equal(b.memory, 'なし'); assert.equal(b.position, 0); assert.equal(b.running, false); assert.deepEqual(b.logs, []); assert.equal(b.retries, 1); });
test('逐次処理と5回繰り返し', () => { assert.equal(commands('5回繰り返す\n攻撃する\nここまで\n防御する').length, 6); });
test('0回と開始値が終了値を超えるカウンタは実行しない', () => { assert.equal(commands('0回繰り返す\n攻撃する\nここまで\niを3から1まで繰り返す\n防御する\nここまで').length, 0); });
test('カウンタ・剰余・条件分岐', () => { assert.deepEqual(commands('iを1から4まで繰り返す\nもし、i % 2 = 0ならば\n防御する\n違えば\n攻撃する\nここまで\nここまで').map(e => e.action), ['攻撃', '防御', '攻撃', '防御']); });
test('違えばもし、文字列比較と記憶', () => { assert.equal(commands('もし、敵HP = 0ならば\n攻撃する\n違えばもし、記憶 = 「詠唱」ならば\n回避する\n違えば\n防御する\nここまで', { 記憶: '詠唱' })[0].action, '回避'); });
test('ネストした条件・繰り返し・別カウンタ', () => { assert.equal(commands('iを1から2まで繰り返す\njを1から3まで繰り返す\nもし、i > 0ならば\n2回繰り返す\n攻撃する\nここまで\nここまで\nここまで\nここまで').length, 12); });
test('論理演算・優先順位・加減乗除', () => { assert.equal(commands('もし、NOT ターン = 2 AND (2 + 3 * 4 - 2) / 2 = 6 OR 敵HP = 0ならば\n攻撃する\nここまで').length, 1); });
test('OR / ANDは短絡評価する', () => { assert.equal(commands('もし、1 = 1 OR 1 / 0 = 0ならば\n攻撃する\nここまで').length, 1); });
for (const code of ['未知の命令', 'もし、ターン = 1ならば\n攻撃する', 'ここまで', 'もし、現在行動 = 「攻撃」ならば\n攻撃する\nここまで', 'もし、i = 1ならば\n攻撃する\nここまで', '違えば', '2回繰り返す\n違えば\nここまで', 'もし、ターン = 「未閉鎖ならば\n攻撃する\nここまで']) {
  test(`不正構文を行番号付きで拒否：${code.split('\n')[0]}`, () => assert.throws(() => compile(code), e => e instanceof CodeError && /行目/.test(e.message)));
}
test('1001行以上を拒否', () => assert.throws(() => compile('\n'.repeat(1000)), /1000行/));
test('過度な入れ子を拒否', () => assert.throws(() => compile('1回繰り返す\n'.repeat(66) + 'ここまで\n'.repeat(66)), /入れ子/));
test('章別の構文解放', () => { assert.throws(() => compile('攻撃する', CHAPTERS[0].features), /解放/); compile('攻撃する', CHAPTERS[1].features); assert.throws(() => compile('2回繰り返す\n攻撃する\nここまで', CHAPTERS[1].features), /解放/); });
test('巨大な空ループにも命令上限が効く', () => assert.throws(() => [...execute(compile('999999999回繰り返す\nここまで'), () => ({}), 100)], /上限/));
test('整数以外・負の回数・ゼロ除算を行番号付きで拒否', () => { for (const code of ['1.5回繰り返す\nここまで', '-1回繰り返す\nここまで', '(1 / 0)回繰り返す\nここまで']) assert.throws(() => commands(code), CodeError); });
test('RUNの構文エラーは戦闘に影響しない', async () => { const b = new Battle(enemy(['待機'])); await assert.rejects(runProgram(b, '攻撃する\n不正', fast), CodeError); assert.equal(b.hp, 5); assert.equal(b.turn, 1); assert.equal(b.running, false); });
test('RUN中は手動不可・二重RUN不可、終了後は手動に戻る', async () => {
  const b = new Battle(enemy(['待機'])); let unlock; let blocked = false;
  const pending = runProgram(b, '攻撃する', { delay: () => new Promise(r => { unlock = r; }), onUpdate: () => { if (b.running) { assert.equal(b.perform('攻撃'), null); blocked = true; } } });
  assert.equal(b.running, true); assert.equal(await runProgram(b, '攻撃する', fast), false); assert.equal(b.retry(), false); unlock(); await pending;
  assert.equal(blocked, true); assert.equal(b.running, false); assert.equal(b.hp, 4); b.perform('攻撃'); assert.equal(b.hp, 3);
});
test('RUN死亡で即停止し、コード行をログに残す', async () => { const b = new Battle(enemy(['攻撃'])); await runProgram(b, '# コメント\n攻撃する\n攻撃する', fast); assert.equal(b.logs.length, 1); assert.equal(b.logs[0].line, 2); assert.equal(b.status, 'dead'); assert.equal(b.running, false); });
test('RUN勝利後は残りの式も評価しない', async () => { const b = new Battle(enemy(['攻撃'], 1)); await runProgram(b, '攻撃する\n(1 / 0)回繰り返す\nここまで', fast); assert.equal(b.status, 'won'); });
test('RUN中の式は現在のターンとHPを参照する', async () => { const b = new Battle(enemy(['待機'])); await runProgram(b, '3回繰り返す\nもし、ターン = 2ならば\n覚える\n違えば\n攻撃する\nここまで\nここまで', fast); assert.equal(b.hp, 3); assert.equal(b.memory, '待機'); assert.equal(b.turn, 4); });
test('実行上限でRUNを解除し、戦闘は継続できる', async () => { const b = new Battle(enemy(['待機'])); let yields = 0; await assert.rejects(runProgram(b, '50000回繰り返す\nここまで', { limit: 200, delay: async () => { yields++; } }), /上限/); assert.ok(yields > 0); assert.equal(b.running, false); assert.equal(b.status, 'active'); });
test('保存・ロード・名前変更・複製・削除・RETRY後のコード保持', () => {
  const map = new Map(), storage = { getItem: k => map.get(k), setItem: (k, v) => map.set(k, v) };
  const s = new ProgramStore(storage); s.draft('攻撃する'); const id = s.save('作戦', '防御する');
  s.rename(id, '作戦2'); const copy = s.duplicate(id); assert.notEqual(copy, id);
  const b = new Battle(enemy(['攻撃'])); b.perform('攻撃'); b.retry();
  const reloaded = new ProgramStore(storage); assert.equal(reloaded.data.draft, '攻撃する'); assert.equal(reloaded.get(id).code, '防御する'); assert.equal(reloaded.get(id).name, '作戦2');
  reloaded.remove(id); assert.equal(reloaded.data.programs.length, 1);
});
test('空の下書きも保持する・壊れた保存データに耐える', () => { const s = new ProgramStore({ getItem: () => '{broken', setItem: () => {} }); assert.deepEqual(s.data.programs, []); const empty = new ProgramStore({ getItem: () => '{"programs":[],"draft":""}' }); assert.equal(empty.hasDraft, true); });
test('初期プログラムでゴブリンに勝利する', async () => { const b = new Battle(ENEMIES[0]); await runProgram(b, '4回繰り返す\n    攻撃する\n    防御する\nここまで', fast); assert.equal(b.status, 'won'); assert.equal(b.logs.length, 7); });
test('実行されない分岐の不正構文も事前に拒否する', () => assert.throws(() => compile('もし、1 = 0ならば\n不正\nここまで'), /2行目/));
test('カウンタは範囲外から参照できず、予約名・同名ネストは禁止', () => { for (const code of ['iを1から2まで繰り返す\nここまで\nもし、i = 1ならば\nここまで', 'ターンを1から2まで繰り返す\nここまで', 'iを1から2まで繰り返す\niを1から2まで繰り返す\nここまで\nここまで']) assert.throws(() => compile(code), CodeError); });
test('長すぎる式を行番号付きで拒否する', () => assert.throws(() => compile(`もし、${'1 + '.repeat(300)}1 = 0ならば\nここまで`), /1行目/));
test('低速・高速の待ち時間とログ項目', async () => {
  for (const [speed, expected] of [['slow', 550], ['fast', 8]]) {
    const b = new Battle(enemy(['待機'])); const delays = [];
    await runProgram(b, '攻撃する', { speed, delay: async n => { delays.push(n); } });
    assert.deepEqual(delays, [expected]); assert.deepEqual(b.logs[0], { turn: 1, source: 'RUN', action: '攻撃', enemyAction: '待機', memory: 'なし', result: '生存', line: 1, codeText: '攻撃する' });
  }
});
test('保存失敗は呼び出し元へ理由を返す', () => { const s = new ProgramStore({ getItem: () => null, setItem: () => { throw new Error('容量不足'); } }); assert.throws(() => s.save('作戦', '攻撃する'), /容量不足/); });
test('カウンタ名がオブジェクトの内部プロパティ名と一致しても安全', () => { assert.equal(commands('__proto__を1から2まで繰り返す\nもし、__proto__ = 2ならば\n攻撃する\nここまで\nここまで').length, 1); });
