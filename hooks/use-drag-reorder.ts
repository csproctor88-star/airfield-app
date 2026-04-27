import { useState } from 'react'

/**
 * Generic drag-to-reorder hook for vertical lists. Mirrors the
 * sidebar nav drag-and-drop pattern but at the per-item level.
 *
 * Usage:
 *   const { getDragProps, draggedId, dragOverId } = useDragReorder(
 *     items,             // array of items with `id`, in current visual order
 *     async (next) => {  // called when user drops; receives reordered array
 *       await persistOrder(next)
 *       await reload()
 *     },
 *   )
 *
 *   {items.map(item => (
 *     <div {...getDragProps(item.id)} style={{
 *       opacity: draggedId === item.id ? 0.4 : 1,
 *       borderTop: dragOverId === item.id && draggedId !== item.id
 *         ? '2px solid var(--color-cyan)'
 *         : '2px solid transparent',
 *     }}>...</div>
 *   ))}
 *
 * Drop semantics: dropping on a target row inserts the dragged
 * item BEFORE that row (i.e. takes the target's position; target
 * shifts down).
 */
export function useDragReorder<T extends { id: string }>(
  items: T[],
  onReorder: (next: T[]) => void | Promise<void>,
) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  function reset() {
    setDraggedId(null)
    setDragOverId(null)
  }

  // Drag-source props — apply to the element the user grabs. Use this
  // alone on small lists where the whole row is the drag handle, or
  // split it into getHandleProps + getDropProps when the row contains
  // its own click/input behavior.
  function getHandleProps(itemId: string) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDraggedId(itemId)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', itemId)
      },
      onDragEnd: reset,
    }
  }

  function getDropProps(itemId: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (draggedId && itemId !== draggedId) setDragOverId(itemId)
      },
      onDragLeave: () => setDragOverId(null),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        const sourceId = draggedId
        reset()
        if (!sourceId || sourceId === itemId) return
        const fromIdx = items.findIndex((i) => i.id === sourceId)
        const toIdx = items.findIndex((i) => i.id === itemId)
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
        const next = [...items]
        const [moved] = next.splice(fromIdx, 1)
        // Splicing-out shifts indices when moving downward; compensate
        // so the dragged item lands BEFORE the target rather than after.
        const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
        next.splice(insertIdx, 0, moved)
        Promise.resolve(onReorder(next))
      },
    }
  }

  function getDragProps(itemId: string) {
    return { ...getHandleProps(itemId), ...getDropProps(itemId) }
  }

  return { draggedId, dragOverId, getDragProps, getHandleProps, getDropProps }
}
