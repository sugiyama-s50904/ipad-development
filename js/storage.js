export class ProgramStore {
  constructor(storage, key = 'shintaku-yusha-v1') { this.storage = storage; this.key = key; this.data = { programs: [], draft: '', retries: 0 }; this.read(); }
  read() {
    try {
      const d = JSON.parse(this.storage.getItem(this.key));
      if (d && Array.isArray(d.programs)) { this.hasDraft = typeof d.draft === 'string'; this.data = {
        programs: d.programs.filter(p => typeof p.id === 'string' && typeof p.name === 'string' && typeof p.code === 'string'),
        draft: typeof d.draft === 'string' ? d.draft : '', retries: Number.isSafeInteger(d.retries) && d.retries >= 0 ? d.retries : 0,
      }; }
    } catch { /* 壊れた保存データは初期値で開始 */ }
  }
  commit() { this.storage.setItem(this.key, JSON.stringify(this.data)); }
  draft(code) { this.data.draft = code; this.commit(); }
  save(name, code, id = null) {
    if (!name.trim()) throw new Error('名前を入力してください');
    const old = this.data.programs.find(p => p.id === id);
    if (old) { old.name = name.trim(); old.code = code; }
    else { id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${this.data.programs.length}`; this.data.programs.push({ id, name: name.trim(), code }); }
    this.commit(); return id;
  }
  rename(id, name) { const p = this.get(id); if (!p) throw new Error('プログラムを選択してください'); return this.save(name, p.code, id); }
  duplicate(id) { const p = this.get(id); if (!p) throw new Error('プログラムを選択してください'); return this.save(`${p.name} のコピー`, p.code); }
  remove(id) { this.data.programs = this.data.programs.filter(p => p.id !== id); this.commit(); }
  get(id) { return this.data.programs.find(p => p.id === id); }
}
