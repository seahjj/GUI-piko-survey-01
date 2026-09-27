export function seededShuffle<T>(items: T[], seed: string): T[] {
  const result = [...items]
  let value = Array.from(seed).reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7)
  for (let index = result.length - 1; index > 0; index -= 1) {
    value = (value * 1664525 + 1013904223) >>> 0
    const swapIndex = value % (index + 1)
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}
