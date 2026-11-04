import { useDraggable, useDroppable } from '@dnd-kit/react'
import type { DragData, DropData } from './domain/dnd'

/**
 * The only place that talks to the drag library (D-020). Sources carry `DragData`, targets carry
 * `DropData`; `BinderDndProvider` turns a completed drag into `resolveDrop()`.
 */
export function useDragSource(id: string, data: DragData, disabled = false) {
  const { ref, isDragging } = useDraggable({ id, data, type: data.kind, disabled })
  return { dragRef: ref, isDragging }
}

export function useDropTarget(id: string, data: DropData, accept: readonly DragData['kind'][], disabled = false) {
  const { ref, isDropTarget } = useDroppable({ id, data, type: data.kind, accept: [...accept], disabled })
  return { dropRef: ref, isDropTarget }
}
