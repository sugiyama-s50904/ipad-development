/**
 * 敵グラフィック専用ファイル。
 * PNGは assets/enemies/ に置きます。下の src はこのJSファイルからの相対パスです。
 * 同じファイル名で画像を置くだけで、コード編集なしで差し替えできます。
 * 未設定・ファイルがない・読み込み失敗の場合は仮SVGを表示します。
 * 新しい敵は js/data.js の id と同じキーで追加してください。
 */
export const ENEMY_GRAPHICS = {
  goblin:   { src: '../assets/enemies/goblin.png' }, // 見張りゴブリン
  mage:     { src: '../assets/enemies/mage.png' }, // 月影の魔導士
  guardian: { src: '../assets/enemies/guardian.png' }, // 古城の番人
  slime:    { src: '../assets/enemies/slime.png' }, // 訓練スライム
};

const FALLBACK_SHAPES = {
    goblin: '<path d="M45 62 12 42 30 90 48 94M135 62 168 42 150 90 132 94"/><path d="M58 103 40 148 140 148 122 103"/><path d="M50 50 68 30 112 30 130 50 130 98 111 120 69 120 50 98Z"/><path fill="#202d28" d="M61 67h19v14H61zM100 67h19v14h-19z"/><path fill="#f0e5c3" d="m65 96 9 14 5-14m22 0 5 14 9-14"/><path fill="none" stroke="#31493e" stroke-width="7" d="M81 100h18"/>',
    mage: '<path d="m90 12 45 61H45Z"/><path fill="#273047" d="M58 65h64v42H58z"/><path fill="#e7c47f" d="M68 79h12v8H68zm32 0h12v8h-12z"/><path d="m59 99-29 50h120l-29-50Z"/><path fill="none" stroke="#e7c47f" stroke-width="7" d="M145 42v107"/><circle fill="#83d4df" cx="145" cy="37" r="12"/>',
    guardian: '<path d="M65 23h50l12 28-10 50H63L53 51Z"/><path fill="#283343" d="M64 52h52v16H64z"/><path fill="#d26d56" d="M70 56h13v6H70zm27 0h13v6H97z"/><path d="m55 92-25 13 8 39h104l8-39-25-13Z"/><path fill="#667b8b" d="m12 83 25-10 21 13-5 43-19 17-19-16Z"/><path fill="none" stroke="#e9e8ce" stroke-width="8" d="M150 40v96"/><path fill="none" stroke="#a58a55" stroke-width="9" d="M135 101h30M150 103v43"/>',
    slime: '<path d="M22 120Q26 75 62 74L90 40l28 34q36 1 40 46 0 27-68 27T22 120Z"/><ellipse fill="#202d3d" cx="68" cy="109" rx="6" ry="9"/><ellipse fill="#202d3d" cx="112" cy="109" rx="6" ry="9"/><path fill="none" stroke="#202d3d" stroke-width="5" d="M74 125q16 12 32 0"/>',
  };

export function renderEnemyGraphic(svg, enemy) {
  svg.setAttribute('aria-label', enemy.name);
  const fallback = () => {
    // 固定の仮SVGのみ。画像パスはHTML文字列へ挿入しません。
    svg.innerHTML = `<g fill="${enemy.color}" stroke="#101722" stroke-width="3" stroke-linejoin="round">${FALLBACK_SHAPES[enemy.sprite] ?? FALLBACK_SHAPES.slime}</g>`;
  };
  const src = ENEMY_GRAPHICS[enemy.id]?.src;
  if (!src) { fallback(); return; }
  // モジュールからの相対URLなので、GitHub Pagesのサブディレクトリでも動作します。
  const imageUrl = new URL(src, import.meta.url).href;
  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  image.setAttribute('width', '180');
  image.setAttribute('height', '160');
  image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  image.addEventListener('error', () => {
    // 敵を切り替えた後に古い画像のエラーが届いても、現在の敵を上書きしない。
    if (image.parentNode === svg) fallback();
  }, { once: true });
  svg.replaceChildren(image);
  image.setAttribute('href', imageUrl);
}
