import { describe, expect, it } from 'vitest';
import { TEST_UNITS, resolveAdUnits } from './units';

const real = {
  banner: 'ca-app-pub-1/1',
  interstitial: 'ca-app-pub-1/2',
  rewarded: 'ca-app-pub-1/3',
};

describe('resolveAdUnits', () => {
  it('geliştirmede gerçek birim olsa bile test birimlerini kullanır', () => {
    expect(resolveAdUnits(real, true)).toEqual(TEST_UNITS);
  });

  it('mağaza derlemesinde verilen birimleri kullanır', () => {
    expect(resolveAdUnits(real, false)).toEqual(real);
  });

  it('eksik ya da bozuk birimde teste düşer', () => {
    expect(resolveAdUnits({ banner: '', rewarded: 42 }, false)).toEqual(TEST_UNITS);
    expect(resolveAdUnits(undefined, false)).toEqual(TEST_UNITS);
  });
});
