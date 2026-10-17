import { createRng } from './rng';
import {
  addEmptyJar,
  createGame,
  isStuck,
  isWon,
  pour,
  shuffleJars,
  type PourOutcome,
} from './rules';
import { hint, solve } from './solver';
import type { GameState, LevelDef, Move } from './types';

/**
 * Bir seviye oturumu: durum + geri alma geçmişi + kullanılan güçlendiriciler. Saf; uygulama ve
 * web prototipi aynı mantığı kullanır.
 */
export interface Session {
  level: LevelDef;
  state: GameState;
  history: GameState[];
  moves: number;
  usedUndo: boolean;
  boostersUsed: number;
  shuffles: number;
}

export function createSession(level: LevelDef): Session {
  return {
    level,
    state: createGame(level),
    history: [],
    moves: 0,
    usedUndo: false,
    boostersUsed: 0,
    shuffles: 0,
  };
}

export function sessionPour(
  s: Session,
  from: number,
  to: number,
): { session: Session; result: PourOutcome } {
  const result = pour(s.state, from, to);
  if (!result.ok) return { session: s, result };
  return {
    result,
    session: {
      ...s,
      state: result.state,
      history: [...s.history, s.state].slice(-50),
      moves: s.moves + 1,
    },
  };
}

export const canUndo = (s: Session) => s.history.length > 0;

/** Geri al: en fazla `steps` dökümü geri alır. */
export function sessionUndo(s: Session, steps: number): Session {
  if (!canUndo(s)) return s;
  const k = Math.min(steps, s.history.length);
  const state = s.history[s.history.length - k]!;
  return {
    ...s,
    state,
    history: s.history.slice(0, s.history.length - k),
    usedUndo: true,
    boostersUsed: s.boostersUsed + 1,
  };
}

export function sessionAddJar(s: Session): Session {
  return {
    ...s,
    state: addEmptyJar(s.state),
    history: [...s.history, s.state],
    boostersUsed: s.boostersUsed + 1,
  };
}

/**
 * Karıştır: yalnızca kilitlenince. Çözülebilir bir karışım bulunana kadar seed'li dener
 * (`seed:shuffle:<kullanım>:<deneme>`), bulamazsa null.
 */
export function sessionShuffle(s: Session): Session | null {
  for (let attempt = 0; attempt < 25; attempt++) {
    const rng = createRng(`${s.level.seed}:shuffle:${s.shuffles}:${attempt}`);
    const next = shuffleJars(s.state, rng);
    if (isStuck(next)) continue;
    const r = solve(next, { maxNodes: 40_000, weight: 3 });
    if (!r.solved) continue;
    return {
      ...s,
      state: next,
      history: [...s.history, s.state],
      boostersUsed: s.boostersUsed + 1,
      shuffles: s.shuffles + 1,
    };
  }
  return null;
}

export function sessionHint(s: Session): Move | null {
  return hint(s.state);
}

export const sessionWon = (s: Session) => isWon(s.state);
export const sessionStuck = (s: Session) => isStuck(s.state);
