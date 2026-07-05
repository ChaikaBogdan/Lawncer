import seedrandom from 'seedrandom'

export interface Rng {
  next(): number
  int(maxExclusive: number): number
}

export function createRng(seed: string): Rng {
  const generator = seedrandom(seed)
  return {
    next: () => generator(),
    int: (maxExclusive: number) => Math.floor(generator() * maxExclusive),
  }
}
