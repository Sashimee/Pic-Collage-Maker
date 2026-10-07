import { create } from 'zustand'
import { type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

/** An optional button rendered inside the toast, before the dismiss ✕. */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  message: ReactNode
  type: ToastType
  duration: number
  action?: ToastAction
}

interface ToastState {
  toasts: Toast[]
  /** Returns the toast's id, so a long-running one can be updated or removed. */
  add: (
    message: ReactNode,
    type?: ToastType,
    duration?: number,
    action?: ToastAction,
  ) => string
  /** Replace the message of a toast still on screen. No-op once it is gone. */
  update: (id: string, message: ReactNode) => void
  remove: (id: string) => void
}

let uid = 0

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  add(message, type = 'info', duration = 3000, action) {
    const id = `toast-${++uid}`
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration, action }] }))
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
    return id
  },
  update(id, message) {
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, message } : t)),
    }))
  },
  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

/** A toast offering to take back what just happened. The undo runs at most once and takes the toast with it. */
export function addUndoToast(message: string, label: string, onUndo: () => void, duration = 6000) {
  let used = false
  const id = useToast.getState().add(message, 'info', duration, {
    label,
    onClick: () => {
      if (used) return
      used = true
      useToast.getState().remove(id)
      onUndo()
    },
  })
  return id
}
