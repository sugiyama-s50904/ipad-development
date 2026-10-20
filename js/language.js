export class CodeError extends Error {
  constructor(line, message) { super(`${line}行目: ${message}`); this.line = line; }
}
const fail = (line, message) => { throw new CodeError(line, message); };
const priority = { OR: 1, AND: 2, '=': 3, '==': 3, '!=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5 };
const featureNames = { sequence: 'コード実行', repeat: '回数繰り返し', if: 'もし', else: '違えば', elseif: '違えばもし', memory: '覚える・記憶', logic: '論理演算', counter: 'カウンタ繰り返し', arithmetic: '算術演算' };
export function tokenize(text, line) {
  const tokens = []; let i = 0;
  while (i < text.length) {
    if (tokens.length >= 512) fail(line, '1つの式は512トークンまでです');
    if (/\s/.test(text[i])) { i++; continue; }
    const c = text[i];
    if (c === '「' || c === '"' || c === "'") {
      const end = text.indexOf(c === '「' ? '」' : c, i + 1);
      if (end < 0) fail(line, '文字列が閉じられていません');
      tokens.push({ type: 'value', value: text.slice(i + 1, end) }); i = end + 1; continue;
    }
    const rest = text.slice(i);
    const number = rest.match(/^\d+(?:\.\d+)?/);
    if (number) { tokens.push({ type: 'value', value: Number(number[0]) }); i += number[0].length; continue; }
    const op = rest.match(/^(?:<=|>=|!=|==|[=<>+*/%()\-])/);
    if (op) { tokens.push({ type: 'op', value: op[0] }); i += op[0].length; continue; }
    const name = rest.match(/^[\p{L}_][\p{L}\p{N}_]*/u);
    if (name) { tokens.push({ type: ['AND', 'OR', 'NOT'].includes(name[0]) ? 'op' : 'name', value: name[0] }); i += name[0].length; continue; }
    fail(line, `使用できない文字「${c}」です`);
  }
  return tokens;
}
function expression(text, line, scope, use) {
  const tokens = tokenize(text, line); let pos = 0;
  function parse(min = 0, depth = 0) {
    if (depth > 64) fail(line, '式の入れ子は64段までです');
    const t = tokens[pos++]; if (!t) fail(line, '式が不足しています');
    let left;
    if (t.type === 'value') left = { kind: 'value', value: t.value };
    else if (t.type === 'name') {
      if (!['ターン', '敵HP', '記憶', ...scope].includes(t.value)) fail(line, `参照できない値「${t.value}」です`);
      if (t.value === '記憶') use('memory', line);
      left = { kind: 'name', name: t.value };
    } else if (['NOT', '-', '+'].includes(t.value)) {
      use(t.value === 'NOT' ? 'logic' : 'arithmetic', line);
      left = { kind: 'unary', op: t.value, right: parse(t.value === 'NOT' ? 3 : 6, depth + 1) };
    } else if (t.value === '(') {
      left = parse(0, depth + 1); if (tokens[pos++]?.value !== ')') fail(line, '閉じ括弧がありません');
    } else fail(line, '値または括弧が必要です');
    while (pos < tokens.length && priority[tokens[pos].value] >= min) {
      const op = tokens[pos++].value;
      if (['AND', 'OR'].includes(op)) use('logic', line);
      if (['+', '-', '*', '/', '%'].includes(op)) use('arithmetic', line);
      left = { kind: 'binary', op, left, right: parse(priority[op] + 1, depth + 1) };
    }
    return left;
  }
  const ast = parse(); if (pos !== tokens.length) fail(line, '式の末尾に余分な文字があります'); return ast;
}
export function compile(code, features = null) {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1000) fail(1001, 'コードは1000行までです');
  if (code.length > 200000) fail(1, 'コードの文字数が多すぎます');
  let index = 0;
  const use = (feature, line) => { if (features && !features.includes(feature)) fail(line, `この章では「${featureNames[feature]}」はまだ解放されていません`); };
  const expr = (s, line, scope) => expression(s.trim(), line, scope, use);
  function block(scope = [], depth = 0) {
    if (depth > 64) fail(index + 1, '構文の入れ子は64段までです');
    const nodes = [];
    while (index < lines.length) {
      const text = lines[index].trim(), line = index + 1;
      if (!text || text.startsWith('#') || text.startsWith('//')) { index++; continue; }
      if (text === 'ここまで' || text.startsWith('違えば')) break;
      index++;
      if (['攻撃する', '防御する', '回避する', '覚える'].includes(text)) {
        use('sequence', line); if (text === '覚える') use('memory', line);
        nodes.push({ kind: 'action', action: text === '覚える' ? text : text.slice(0, -2), line }); continue;
      }
      const condition = text.match(/^もし[、,\s]*(.+)ならば$/);
      if (condition) {
        use('if', line);
        const branches = [{ condition: expr(condition[1], line, scope), body: block(scope, depth + 1), line }];
        let otherwise = [];
        while (index < lines.length) {
          const next = lines[index].trim(), n = index + 1;
          const elseif = next.match(/^違えばもし[、,\s]*(.+)ならば$/);
          if (elseif) { use('elseif', n); index++; branches.push({ condition: expr(elseif[1], n, scope), body: block(scope, depth + 1), line: n }); }
          else if (next === '違えば') { use('else', n); index++; otherwise = block(scope, depth + 1); break; }
          else break;
        }
        if (lines[index]?.trim() !== 'ここまで') fail(index + 1, '条件分岐の「ここまで」が必要です'); index++;
        nodes.push({ kind: 'if', branches, otherwise, line }); continue;
      }
      const counter = text.match(/^([\p{L}_][\p{L}\p{N}_]*)を(.+)から(.+)まで繰り返す$/u);
      const repeat = text.match(/^(.+)回繰り返す$/);
      if (counter || repeat) {
        use(counter ? 'counter' : 'repeat', line);
        const name = counter?.[1];
        if (name && (['ターン', '敵HP', '記憶', 'AND', 'OR', 'NOT'].includes(name) || scope.includes(name))) fail(line, 'このカウンタ名は使用できません');
        const node = counter ? { kind: 'counter', name, start: expr(counter[2], line, scope), end: expr(counter[3], line, scope), line }
          : { kind: 'repeat', count: expr(repeat[1], line, scope), line };
        node.body = block(name ? [...scope, name] : scope, depth + 1);
        if (lines[index]?.trim() !== 'ここまで') fail(index + 1, '繰り返しの「ここまで」が必要です'); index++;
        nodes.push(node); continue;
      }
      fail(line, '命令または構文を認識できません');
    }
    return nodes;
  }
  const ast = block(); if (index < lines.length) fail(index + 1, '対応する開始構文がありません'); return ast;
}
export function evaluate(node, context, line) {
  if (node.kind === 'value') return node.value;
  if (node.kind === 'name') return context[node.name];
  const right = () => evaluate(node.right, context, line);
  if (node.kind === 'unary') { const r = right(); if (node.op === 'NOT') return !r; if (typeof r !== 'number') fail(line, '算術演算には数値が必要です'); return node.op === '-' ? -r : r; }
  const a = evaluate(node.left, context, line);
  if (node.op === 'AND') return Boolean(a) && Boolean(right());
  if (node.op === 'OR') return Boolean(a) || Boolean(right());
  const b = right();
  if (['+', '-', '*', '/', '%'].includes(node.op)) {
    if (typeof a !== 'number' || typeof b !== 'number') fail(line, '算術演算には数値が必要です');
    if ((node.op === '/' || node.op === '%') && b === 0) fail(line, '0で割ることはできません');
    const result = { '+': () => a + b, '-': () => a - b, '*': () => a * b, '/': () => a / b, '%': () => a % b }[node.op]();
    if (!Number.isFinite(result)) fail(line, '計算結果が数値の範囲を超えました'); return result;
  }
  if (['=', '=='].includes(node.op)) return a === b;
  if (node.op === '!=') return a !== b;
  if (typeof a !== typeof b) fail(line, '比較する値の種類を揃えてください');
  return { '<': () => a < b, '>': () => a > b, '<=': () => a <= b, '>=': () => a >= b }[node.op]();
}
export function* execute(ast, getContext, limit = 50000) {
  let count = 0; const counters = Object.create(null);
  function* tick(line) { if (++count > limit) fail(line, `実行命令数の上限（${limit}）に達しました`); yield { kind: 'step', line }; }
  const value = (expr, line) => evaluate(expr, { ...getContext(), ...counters }, line);
  const integer = (expr, line) => { const n = value(expr, line); if (!Number.isSafeInteger(n)) fail(line, '繰り返しには安全な整数が必要です'); return n; };
  function* walk(nodes) {
    for (const n of nodes) {
      yield* tick(n.line);
      if (n.kind === 'action') yield { kind: 'action', action: n.action, line: n.line };
      else if (n.kind === 'if') {
        let body = n.otherwise;
        for (const branch of n.branches) { yield* tick(branch.line); if (value(branch.condition, branch.line)) { body = branch.body; break; } }
        yield* walk(body);
      } else {
        const start = n.kind === 'repeat' ? 1 : integer(n.start, n.line);
        const end = n.kind === 'repeat' ? integer(n.count, n.line) : integer(n.end, n.line);
        if (n.kind === 'repeat' && end < 0) fail(n.line, '繰り返し回数は0以上にしてください');
        for (let i = start; i <= end; i++) {
          yield* tick(n.line); if (n.name) counters[n.name] = i;
          yield* walk(n.body);
        }
        if (n.name) delete counters[n.name];
      }
    }
  }
  yield* walk(ast);
}
