export const ENEMIES = [
  { id: 'goblin', name: '見張りゴブリン', hp: 4, pattern: ['待機', '攻撃'], color: '#8dcc72', sprite: 'goblin' },
  { id: 'mage', name: '月影の魔導士', hp: 4, pattern: ['詠唱', '魔法', '待機'], color: '#b79de8', sprite: 'mage' },
  { id: 'guardian', name: '古城の番人', hp: 6, pattern: ['タメ', '特技', '詠唱', '魔法', '待機', '攻撃'], color: '#dfb56c', sprite: 'guardian' },
  { id: 'slime', name: '訓練スライム', hp: 3, pattern: ['待機'], color: '#75cfe1', sprite: 'slime' },
];
export const FEATURES = ['sequence', 'repeat', 'if', 'else', 'elseif', 'memory', 'logic', 'counter', 'arithmetic'];
export const CHAPTERS = Array.from({ length: 15 }, (_, i) => ({
  number: i + 1, enemyIds: i === 0 ? ['goblin', 'mage', 'guardian'] : ENEMIES.map(e => e.id),
  features: i === 0 ? [] : FEATURES.slice(0, Math.min(i, FEATURES.length)),
  completeContent: false,
}));
export function validateEnemy(enemy) {
  if (!Number.isInteger(enemy.hp) || enemy.hp < 1 || !enemy.pattern.length) throw new Error('敵データが不正です');
  const actions = ['攻撃', 'タメ', '特技', '詠唱', '魔法', '待機'];
  enemy.pattern.forEach((a, i) => {
    const next = enemy.pattern[(i + 1) % enemy.pattern.length];
    if (!actions.includes(a) || (a === 'タメ' && next !== '特技') || (a === '詠唱' && next !== '魔法')) throw new Error('敵の行動パターンが不正です');
  });
}
