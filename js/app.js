import { ENEMIES, CHAPTERS } from './data.js';
import { Battle } from './battle.js';
import { ProgramStore } from './storage.js';
import { runProgram } from './runner.js';
import { renderEnemyGraphic } from './enemy-graphics.js';
const $ = id => document.getElementById(id);
let store;
try { store = new ProgramStore(localStorage); }
catch { store = new ProgramStore({ getItem: () => null, setItem: () => { throw new Error('ブラウザの保存領域を利用できません'); } }); }
const battle = new Battle(ENEMIES[0], store.data.retries);
let activeLine = null, selectedProgram = null;
const defaultCode = '4回繰り返す\n    攻撃する\n    防御する\nここまで';
$('code').value = store.hasDraft ? store.data.draft : defaultCode;
const say = (message, error = false) => { $('message').textContent = message; $('message').classList.toggle('error', error); };
function safe(fn) { try { return fn(); } catch (e) { say(e.message, true); } }
const chapter = () => CHAPTERS[Number($('chapter').value) - 1];
const features = () => $('mode').value === 'test' ? null : chapter().features;
const option = (value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; return o; };
CHAPTERS.forEach(c => $('chapter').append(option(c.number, `CHAPTER ${c.number}`)));
function populateEnemies() {
  const old = $('enemy').value; $('enemy').replaceChildren();
  ENEMIES.filter(e => $('mode').value === 'test' || chapter().enemyIds.includes(e.id)).forEach(e => $('enemy').append(option(e.id, e.name)));
  if ([...$('enemy').options].some(o => o.value === old)) $('enemy').value = old;
}

function resetEnemy() {
  if (battle.running) return;
  battle.reset(ENEMIES.find(e => e.id === $('enemy').value)); activeLine = null;
  $('logs-panel').hidden = true; $('logs').replaceChildren();
  $('enemy-name').textContent = battle.enemy.name; renderEnemyGraphic($('sprite'), battle.enemy);
  $('pattern').replaceChildren(...battle.enemy.pattern.map(a => { const li = document.createElement('li'); li.textContent = a; return li; }));
  render(); renderLines();
}
function render() {
  const running = battle.running, ended = battle.status !== 'active', f = features();
  $('hp').max = battle.enemy.hp; $('hp').value = battle.hp; $('hp-text').textContent = `${battle.hp} / ${battle.enemy.hp}`;
  $('turn').textContent = battle.turn; $('memory').textContent = battle.memory; $('retries').textContent = `累積RETRY：${battle.retries}`;
  const log = battle.logs.at(-1);
  $('latest').textContent = log ? `勇者：${log.action} ／ 敵：${log.enemyAction} ／ ${log.result}` : '行動パターンを読み、神託を与えてください。';
  $('latest').title = $('latest').textContent;
  $('outcome').hidden = !ended; $('outcome-text').textContent = battle.status === 'won' ? '勝利 — 神託は届いた。' : '死亡 — コードを書き直し、再挑戦。';
  document.querySelectorAll('[data-action]').forEach(b => { b.disabled = running || ended || (b.dataset.action === '覚える' && f && !f.includes('memory')); });
  $('code').readOnly = running;
  $('run').disabled = running || ended || (f && !f.includes('sequence'));
  $('run').textContent = running ? '実行中…' : 'RUN ▶';
  ['mode', 'chapter', 'enemy', 'speed', 'retry', 'insert', 'load', 'import', 'text-mode', 'command-mode', 'snippet', 'count', 'condition-value', 'condition-target', 'save', 'save-new', 'rename', 'duplicate', 'delete', 'programs', 'program-name'].forEach(id => { $(id).disabled = running; });
  $('chapter').disabled = running || $('mode').value === 'test';
  if (f && !f.includes('sequence') && !running) say('CHAPTER 1は手動戦闘のみ。章モードの敵・進行はテスト用です。');
}
function renderLines() {
  const count = $('code').value.split('\n').length;
  $('line-numbers').replaceChildren(...Array.from({ length: count }, (_, i) => {
    const d = document.createElement('div'); d.textContent = i + 1; d.classList.toggle('active', activeLine === i + 1); return d;
  }));
  $('line-numbers').scrollTop = $('code').scrollTop;
  $('line-status').textContent = `実行行：${activeLine ?? '—'}`;
}
function highlight(line, select = false) {
  activeLine = line; const code = $('code');
  const lines = code.value.split('\n'); const start = lines.slice(0, line - 1).reduce((n, s) => n + s.length + 1, 0);
  code.scrollTop = Math.max(0, (line - 3) * 24);
  if (select) { code.focus(); code.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0)); }
  renderLines();
}
function saveDraft() { safe(() => store.draft($('code').value)); }
function renderLibrary() {
  $('programs').replaceChildren(option('', '保存済みプログラムを選択'));
  store.data.programs.forEach(p => $('programs').append(option(p.id, p.name)));
  if (store.get(selectedProgram)) $('programs').value = selectedProgram;
}
document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => { battle.perform(b.dataset.action); render(); }));
$('run').addEventListener('click', async () => {
  if ($('run').disabled) return;
  say('プログラムを実行しています。'); activeLine = null; renderLines();
  try {
    await runProgram(battle, $('code').value, { features: features(), speed: $('speed').value, onUpdate: render, onLine: highlight });
    say(battle.status === 'active' ? 'コードが終了しました。手動操作または再度RUNできます。' : '戦闘が終了しました。詳細ログで実行行を確認できます。');
  } catch (e) { say(e.message, true); if (e.line) highlight(e.line, true); }
});
$('retry').addEventListener('click', () => {
  battle.retry(); safe(() => { store.data.retries = battle.retries; store.commit(); }); activeLine = null;
  $('logs-panel').hidden = true; $('logs').replaceChildren(); say('再挑戦。コードは保持しています。'); render(); renderLines();
});
['mode', 'chapter'].forEach(id => $(id).addEventListener('change', () => { populateEnemies(); resetEnemy(); say('戦闘設定を変更しました。章モードは構文解放の確認用です。'); render(); }));
$('enemy').addEventListener('change', resetEnemy);
$('code').addEventListener('input', () => { activeLine = null; renderLines(); saveDraft(); });
$('code').addEventListener('scroll', () => { $('line-numbers').scrollTop = $('code').scrollTop; });
$('code').addEventListener('keydown', e => {
  if (e.key === 'Tab' && !battle.running) { e.preventDefault(); const c = $('code'); c.setRangeText('    ', c.selectionStart, c.selectionEnd, 'end'); renderLines(); saveDraft(); }
});
['text', 'command'].forEach(mode => $(`${mode}-mode`).addEventListener('click', () => {
  $('builder').hidden = mode !== 'command'; $('text-mode').setAttribute('aria-pressed', mode === 'text'); $('command-mode').setAttribute('aria-pressed', mode === 'command');
}));
$('insert').addEventListener('click', () => safe(() => {
  if (battle.running) return;
  const count = Number($('count').value);
  if (!Number.isSafeInteger(count) || count < 0 || count > 50000) throw new Error('回数は0〜50000の整数にしてください');
  const name = $('condition-value').value, input = $('condition-target').value;
  let target;
  if (name === '記憶') { if (/[「」\r\n]/.test(input)) throw new Error('記憶の比較対象に括弧や改行は使えません'); target = `「${input}」`; }
  else { if (!/^-?\d+(?:\.\d+)?$/.test(input)) throw new Error('比較対象に数値を入力してください'); target = input; }
  const snippets = { attack: '攻撃する', defend: '防御する', dodge: '回避する', memory: '覚える', repeat: `${count}回繰り返す\n    攻撃する\nここまで`, counter: `iを1から${count}まで繰り返す\n    攻撃する\nここまで`, if: `もし、${name} = ${target}ならば\n    攻撃する\n違えばもし、${name} != ${target}ならば\n    防御する\n違えば\n    回避する\nここまで` };
  const c = $('code'), start = c.value.lastIndexOf('\n', c.selectionStart - 1) + 1;
  c.setRangeText(`${snippets[$('snippet').value]}\n`, start, start, 'end'); c.focus(); renderLines(); saveDraft();
}));
$('programs').addEventListener('change', () => { selectedProgram = $('programs').value || null; const p = store.get(selectedProgram); if (p) $('program-name').value = p.name; });
function save(newCopy) { safe(() => { selectedProgram = store.save($('program-name').value, $('code').value, newCopy ? null : selectedProgram); renderLibrary(); say('プログラムを保存しました。'); }); }
$('save').addEventListener('click', () => save(false)); $('save-new').addEventListener('click', () => save(true));
$('load').addEventListener('click', () => safe(() => {
  if (battle.running) return; const p = store.get($('programs').value); if (!p) throw new Error('プログラムを選択してください');
  $('code').value = p.code; $('program-name').value = p.name; activeLine = null; renderLines(); saveDraft(); say('プログラムを読み込みました。');
}));
$('rename').addEventListener('click', () => safe(() => { store.rename($('programs').value, $('program-name').value); renderLibrary(); say('名前を変更しました。'); }));
$('duplicate').addEventListener('click', () => safe(() => { selectedProgram = store.duplicate($('programs').value); $('program-name').value = store.get(selectedProgram).name; renderLibrary(); say('複製しました。'); }));
$('delete').addEventListener('click', () => safe(() => { const id = $('programs').value; if (!id) throw new Error('プログラムを選択してください'); store.remove(id); selectedProgram = null; renderLibrary(); say('選択したプログラムを削除しました。'); }));
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([$('code').value], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `${($('program-name').value || '神託').replace(/[\\/:*?"<>|]/g, '_')}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async () => {
  const file = $('import-file').files[0]; $('import-file').value = '';
  if (!file || battle.running) return;
  try {
    if (file.size > 600000) throw new Error('ファイルが大きすぎます');
    const code = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (battle.running) return;
    if (code.split('\n').length > 1000 || code.length > 200000) throw new Error('コードは1000行・200000文字までです');
    $('code').value = code; $('program-name').value = file.name.replace(/\.txt$/i, ''); selectedProgram = null;
    activeLine = null; renderLibrary(); renderLines(); saveDraft(); say('テキストを取り込みました。RUN時に構文を検証します。');
  } catch (e) { say(e.message, true); }
});
$('show-logs').addEventListener('click', () => {
  if (battle.status === 'active') return;
  $('logs').replaceChildren(...battle.logs.map(log => {
    const row = document.createElement('div'); row.className = `log-entry ${log.result.includes('死亡') ? 'dead' : ''}`;
    row.textContent = `TURN ${log.turn} ｜ ${log.source} ｜ 勇者：${log.action} ｜ 敵：${log.enemyAction} ｜ 記憶：${log.memory} ｜ ${log.result}${log.codeText ? ` ｜ 実行時コード：${log.codeText.trim()}` : ''}`;
    if (log.line) { const button = document.createElement('button'); button.textContent = `${log.line}行目`; button.addEventListener('click', () => { highlight(log.line, true); $('code').scrollIntoView({ behavior: 'smooth', block: 'center' }); }); row.append(button); }
    return row;
  }));
  $('logs-panel').hidden = false; $('logs-panel').scrollIntoView({ behavior: 'smooth' }); $('logs').scrollTop = $('logs').scrollHeight;
});
$('close-logs').addEventListener('click', () => { $('logs-panel').hidden = true; });
populateEnemies(); resetEnemy(); renderLibrary(); renderLines();
