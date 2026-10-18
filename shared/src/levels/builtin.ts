import type { LevelDef } from '../types';
import builtin from './builtin.json';

export const BUILTIN_LEVEL_COUNT = 1000;

/** Uygulamaya gömülü, çözücüyle doğrulanmış seviyeler (1..1000). Çevrimdışı oynanır. */
export const BUILTIN_LEVELS = builtin as LevelDef[];

export function builtinLevel(n: number): LevelDef | undefined {
  return BUILTIN_LEVELS[n - 1];
}
