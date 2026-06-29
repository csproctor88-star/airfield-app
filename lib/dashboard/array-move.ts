/** Return a new array with the element at `from` moved to `to`. Out-of-range
 *  indices are a no-op (returns a copy). Never mutates the input. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
