import { describe, expect, it } from 'vitest';
import { hapticFor, injectSaved, parseHostMessage } from './bridge';

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
});
