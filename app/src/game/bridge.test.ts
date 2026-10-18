import { describe, expect, it } from 'vitest';
import { hapticFor, hostEventJs, injectSaved, parseHostMessage, shouldAcceptSave } from './bridge';

describe('oyun köprüsü', () => {
  it('mesajları doğrular', () => {
    expect(parseHostMessage('{"type":"save","data":"{}"}')).toEqual({ type: 'save', data: '{}' });
    expect(parseHostMessage('{"type":"haptic","pattern":[10,40,25]}')).toEqual({
      type: 'haptic',
      pattern: [10, 40, 25],
    });
    expect(parseHostMessage('{"type":"haptic","pattern":"x"}')).toBeNull();
    expect(parseHostMessage('{"type":"save","data":5}')).toBeNull();
    expect(parseHostMessage('bozuk')).toBeNull();
    expect(parseHostMessage('{"type":"bilinmeyen"}')).toBeNull();
  });

  it('titreşimi iPhone geri bildirimine çevirir', () => {
    expect(hapticFor(12)).toBe('light');
    expect(hapticFor(20)).toBe('medium');
    expect(hapticFor(30)).toBe('warning');
    expect(hapticFor([10, 40, 25])).toBe('success');
  });

  it('kaydı güvenli biçimde enjekte eder', () => {
    const js = injectSaved('{"a":"</script> "}');
    const w: { __BS_SAVED?: string | null } = {};
    new Function('window', js)(w);
    expect(w.__BS_SAVED).toBe('{"a":"</script> "}');
    expect(injectSaved(null)).toContain('= null');
  });

  it('ilerleme asla geri gitmez (yalnızca bilerek sıfırlama)', () => {
    const save = (unlocked: number, owned: string[] = []) =>
      JSON.stringify({
        progress: JSON.stringify({
          unlocked,
          owned: Object.fromEntries(owned.map((k) => [k, { styles: [0], selected: 0 }])),
        }),
        level: unlocked,
      });
    expect(shouldAcceptSave(null, save(1))).toBe(true);
    expect(shouldAcceptSave(save(57, ['misir.sign']), save(58, ['misir.sign']))).toBe(true);
    expect(shouldAcceptSave(save(57), save(57))).toBe(true);
    // kayıt okunamayıp oyun sıfırdan başladıysa eski kaydın üstüne yazılmaz
    expect(shouldAcceptSave(save(57, ['misir.sign']), save(1))).toBe(false);
    expect(shouldAcceptSave(save(57, ['misir.sign']), save(57))).toBe(false);
    expect(shouldAcceptSave(save(57), 'bozuk')).toBe(false);
    // bozuk eski kayıt yenisini engellemez; bilerek sıfırlama her zaman geçer
    expect(shouldAcceptSave('bozuk', save(3))).toBe(true);
    expect(shouldAcceptSave(save(57), save(1), true)).toBe(true);
    expect(parseHostMessage('{"type":"save","data":"{}","reset":true}')).toEqual({
      type: 'save',
      data: '{}',
      reset: true,
    });
  });

  it('reklam mesajları ve olaylar', () => {
    expect(parseHostMessage('{"type":"ad","id":3,"kind":"rewarded"}')).toEqual({
      type: 'ad',
      id: 3,
      kind: 'rewarded',
    });
    expect(parseHostMessage('{"type":"ad","id":3,"kind":"video"}')).toBeNull();
    expect(parseHostMessage('{"type":"banner","visible":true}')).toEqual({
      type: 'banner',
      visible: true,
    });
    expect(parseHostMessage('{"type":"privacyOptions"}')).toEqual({ type: 'privacyOptions' });
    const w: { __BS_onHost?: (e: unknown) => void; got?: unknown } = {};
    w.__BS_onHost = (e) => (w.got = e);
    new Function('window', hostEventJs({ type: 'adResult', id: 3, shown: true, rewarded: true }))(
      w,
    );
    expect(w.got).toEqual({ type: 'adResult', id: 3, shown: true, rewarded: true });
    const w2: { __BS_HOST?: unknown } = {};
    new Function('window', injectSaved(null, { ads: true }))(w2);
    expect(w2.__BS_HOST).toEqual({ ads: true });
  });
});
