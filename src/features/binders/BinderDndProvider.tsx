import { DragDropProvider, PointerSensor } from '@dnd-kit/react'
import type { ReactNode } from 'react'
import { isDragData, isDropData, type DragData, type DropData } from './domain/dnd'

type Props = { onDrop: (source: DragData, target: DropData) => void; children: ReactNode }

/**
 * Pointer drag and drop for the binder editor (mouse, pen, and long-press on touch). The library's
 * keyboard sensor is left out on purpose: slots already have their own keyboard path
 * (select → arrows → Enter), which doubles as the accessible alternative.
 */
export function BinderDndProvider({ onDrop, children }: Props) {
  return (
    <DragDropProvider
      sensors={[PointerSensor]}
      onDragEnd={(event) => {
        if (event.canceled) return
        const source: unknown = event.operation.source?.data
        const target: unknown = event.operation.target?.data
        if (isDragData(source) && isDropData(target)) onDrop(source, target)
      }}
    >
      {children}
    </DragDropProvider>
  )
}
