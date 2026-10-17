import { describe, expect, it } from 'vitest';
import {
  addEmptyJar,
  checkPour,
  createGame,
  isStuck,
  isWon,
  meaningfulMoves,
  pour,
  shuffleJars,
  stateKey,
  topRun,
  validMoves,
} from './rules';
import { createRng } from './rng';
import type { JarDef } from './types';

const game = (jars: JarDef[], cap = 4) => createGame({ cap, jars });

describe('döküm', () => {
  it('aynı renkli bitişik üst katmanları sığdığı kadar döker', () => {
    const s = game([{ layers: [1, 0, 0] }, { layers: [0] }]);
    const r = pour(s, 0, 1);
    expect(r.ok && r.amount).toBe(2);
    if (!r.ok) return;
    expect(r.state.jars[0]!.layers).toEqual([1]);
    expect(r.state.jars[1]!.layers).toEqual([0, 0, 0]);
  });

  it('hedefte yer kadar döker, kalanı kaynakta bırakır', () => {
    const s = game([{ layers: [0, 0, 0] }, { layers: [1, 1, 0] }]);
    const r = pour(s, 0, 1);
    expect(r.ok && r.amount).toBe(1);
    if (r.ok) expect(r.state.jars[0]!.layers).toEqual([0, 0]);
  });

  it('boş hedefe dökmek geçerli', () => {
    expect(checkPour(game([{ layers: [2] }, { layers: [] }]), 0, 1).ok).toBe(true);
  });

  it('farklı renk, dolu hedef, boş kaynak ve aynı kavanoz geçersiz', () => {
    const s = game([{ layers: [0] }, { layers: [1] }, { layers: [0, 0, 0, 1] }, { layers: [] }]);
    expect(checkPour(s, 0, 1)).toEqual({ ok: false, reason: 'mismatch' });
    expect(checkPour(s, 1, 2)).toEqual({ ok: false, reason: 'full' });
    expect(checkPour(s, 3, 0)).toEqual({ ok: false, reason: 'empty' });
    expect(checkPour(s, 0, 0)).toEqual({ ok: false, reason: 'same' });
  });

  it('geçersiz döküm durumu değiştirmez', () => {
    const s = game([{ layers: [0] }, { layers: [1] }]);
    const r = pour(s, 0, 1);
    expect(r.ok).toBe(false);
    expect(s.jars[0]!.layers).toEqual([0]);
  });

  it('tek renkle dolan kavanoz kapanır ve artık kullanılamaz', () => {
    const s = game([{ layers: [0, 0, 0] }, { layers: [1, 0] }, { layers: [] }]);
    const r = pour(s, 1, 0);
    expect(r.ok && r.capped).toBe(true);
    if (!r.ok) return;
    expect(r.state.jars[0]!.capped).toBe(true);
    expect(checkPour(r.state, 0, 2)).toEqual({ ok: false, reason: 'source-closed' });
    expect(checkPour(r.state, 1, 0)).toEqual({ ok: false, reason: 'target-closed' });
  });

  it('dar ağızlı kavanoz tek seferde 1 katman alır ve verir', () => {
    const s = game([{ layers: [0, 0, 0], narrow: true }, { layers: [] }, { layers: [1, 1] }]);
    const r = pour(s, 0, 1);
    expect(r.ok && r.amount).toBe(1);
    const t = game([{ layers: [2, 1, 1] }, { layers: [], narrow: true }]);
    const r2 = pour(t, 0, 1);
    expect(r2.ok && r2.amount).toBe(1);
  });

  it('kilitli kavanoz, o renk kapanana kadar kullanılamaz; kapanınca açılır', () => {
    const s = game([
      { layers: [2, 1], lock: 0 },
      { layers: [0, 0, 0] },
      { layers: [0] },
      { layers: [] },
    ]);
    expect(checkPour(s, 0, 3)).toEqual({ ok: false, reason: 'source-closed' });
    expect(checkPour(s, 3, 0).ok).toBe(false);
    const r = pour(s, 2, 1);
    expect(r.ok && r.unlocked).toEqual([0]);
    if (r.ok) expect(checkPour(r.state, 0, 3).ok).toBe(true);
  });

  it('gizli katman üste çıkınca açılır ve bir daha gizlenmez', () => {
    const s = game([{ layers: [1, 2, 0], hidden: 2 }, { layers: [] }, { layers: [] }]);
    expect(s.jars[0]!.hidden).toBe(2);
    const r = pour(s, 0, 1);
    expect(r.ok && r.revealed).toBe(true);
    if (!r.ok) return;
    expect(r.state.jars[0]!.hidden).toBe(1);
    const r2 = pour(r.state, 0, 2);
    expect(r2.ok && r2.state.jars[0]!.hidden).toBe(0);
    // Üste döküm gizliyi geri getirmez.
    if (r2.ok) {
      const r3 = pour(r2.state, 2, 0);
      expect(r3.ok).toBe(false);
    }
  });

  it('en üst katman hiçbir zaman gizli değildir', () => {
    expect(game([{ layers: [1, 2], hidden: 5 }]).jars[0]!.hidden).toBe(1);
  });

  it('topRun', () => {
    expect(topRun(game([{ layers: [1, 0, 0] }]).jars[0]!)).toBe(2);
    expect(topRun(game([{ layers: [] }]).jars[0]!)).toBe(0);
  });
});

describe('kazanma ve kilitlenme', () => {
  it('tüm kavanozlar kapalı ya da boşsa kazanılır', () => {
    let s = game([{ layers: [0, 0, 0] }, { layers: [0] }, { layers: [] }]);
    expect(isWon(s)).toBe(false);
    const r = pour(s, 1, 0);
    if (r.ok) s = r.state;
    expect(isWon(s)).toBe(true);
  });

  it('geçerli hamle yoksa kilitlenme algılanır', () => {
    const s = game([{ layers: [0, 1, 0, 1] }, { layers: [1, 0, 1, 0] }]);
    expect(validMoves(s)).toHaveLength(0);
    expect(isStuck(s)).toBe(true);
  });

  it('yalnızca ileri geri hamleler kaldıysa da kilitlenme sayılır', () => {
    // İki kavanozun üstü aynı renk ama hiçbir şey ilerlemez.
    const s = game([
      { layers: [1, 2, 0] },
      { layers: [2, 1, 0] },
      { layers: [1, 2, 1, 2] },
      { layers: [2, 1, 2, 1] },
    ]);
    expect(validMoves(s).length).toBeGreaterThan(0);
    expect(isStuck(s)).toBe(true);
  });

  it('çözülebilir başlangıç kilitli sayılmaz', () => {
    const s = game([{ layers: [0, 1] }, { layers: [1, 0] }, { layers: [] }], 2);
    expect(isStuck(s)).toBe(false);
  });

  it('boş kavanoz eklemek kilitlenmeyi çözebilir', () => {
    const s = game([{ layers: [0, 1, 0, 1] }, { layers: [1, 0, 1, 0] }]);
    expect(isStuck(addEmptyJar(s))).toBe(false);
  });
});

describe('simetri', () => {
  it('kanonik anahtar kavanoz sırasından bağımsızdır', () => {
    const a = game([{ layers: [0, 1] }, { layers: [1] }, { layers: [] }]);
    const b = game([{ layers: [] }, { layers: [1] }, { layers: [0, 1] }]);
    expect(stateKey(a)).toBe(stateKey(b));
  });

  it('anlamlı hamleler ikinci boş kavanozu ve tek renkli kavanozu boşa aktarmayı atlar', () => {
    const s = game([{ layers: [0, 0] }, { layers: [1, 0] }, { layers: [] }, { layers: [] }]);
    const all = validMoves(s);
    const m = meaningfulMoves(s);
    expect(all.length).toBeGreaterThan(m.length);
    expect(m).not.toContainEqual({ from: 0, to: 2 });
    expect(m).toContainEqual({ from: 1, to: 2 });
    expect(m).not.toContainEqual({ from: 1, to: 3 });
  });
});

describe('karıştır', () => {
  it('katman sayılarını ve kavanoz doluluklarını korur, deterministiktir', () => {
    const s = game([
      { layers: [0, 1, 2, 0] },
      { layers: [2, 1] },
      { layers: [1, 2, 0, 0] },
      { layers: [1, 2] },
    ]);
    const a = shuffleJars(s, createRng('x'));
    const b = shuffleJars(s, createRng('x'));
    expect(a).toEqual(b);
    expect(a.jars.map((j) => j.layers.length)).toEqual([4, 2, 4, 2]);
    const count = (st: typeof s) =>
      st.jars
        .flatMap((j) => j.layers)
        .sort()
        .join();
    expect(count(a)).toBe(count(s));
  });
});
