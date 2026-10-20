import { validateEnemy } from './data.js';
export class Battle {
  constructor(enemy, retries = 0) { this.retries = retries; this.reset(enemy); }
  reset(enemy = this.enemy) {
    validateEnemy(enemy); this.enemy = enemy; this.hp = enemy.hp; this.turn = 1;
    this.memory = 'なし'; this.position = 0; this.status = 'active'; this.running = false; this.logs = [];
  }
  retry() { if (this.running) return false; this.retries++; this.reset(); return true; }
  perform(action, source = '手動', line = null) {
    if (this.status !== 'active' || (this.running && source !== 'RUN')) return null;
    if (!['攻撃', '防御', '回避', '覚える'].includes(action)) throw new Error('不正なコマンド');
    if (action === '攻撃') this.hp--;
    let enemyAction = '未実行', result = '生存';
    if (this.hp === 0) { this.status = 'won'; result = '勝利'; }
    else {
      enemyAction = this.enemy.pattern[this.position];
      const required = { 攻撃: '防御', 特技: '防御', 魔法: '回避' }[enemyAction];
      if (required && action !== required) { this.status = 'dead'; result = '被弾・死亡'; }
      if (action === '覚える') this.memory = enemyAction;
      this.position = (this.position + 1) % this.enemy.pattern.length;
    }
    const log = { turn: this.turn, source, action, enemyAction, memory: this.memory, result, line };
    this.logs.push(log);
    if (this.status === 'active') this.turn++;
    return log;
  }
  context() { return { ターン: this.turn, 敵HP: this.hp, 記憶: this.memory }; }
}
