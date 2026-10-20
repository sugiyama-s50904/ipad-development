import { compile, execute } from './language.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function runProgram(battle, code, { features = null, speed = 'fast', onUpdate = () => {}, onLine = () => {}, delay = sleep, limit = 50000 } = {}) {
  if (battle.running || battle.status !== 'active') return false;
  const ast = compile(code, features); // 構文全体の検証が完了するまで戦闘を変更しない
  battle.running = true; onUpdate();
  let steps = 0;
  try {
    const iterator = execute(ast, () => battle.context(), limit);
    while (battle.status === 'active') {
      const next = iterator.next(); if (next.done) break;
      const event = next.value;
      if (event.kind === 'action') {
        onLine(event.line);
        const log = battle.perform(event.action, 'RUN', event.line);
        log.codeText = code.split('\n')[event.line - 1];
        onUpdate();
        await delay(speed === 'slow' ? 550 : 8);
      } else if (++steps % 100 === 0) await delay(0);
    }
    return true;
  } finally { battle.running = false; onUpdate(); }
}
