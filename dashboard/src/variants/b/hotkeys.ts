import { useEffect, useRef } from "react"

export interface Hotkey {
  /** lower-case letter, digit, "escape", "backspace", "[" or "]" */
  key: string
  run: () => void
  disabled?: boolean
}

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return !!target.closest(
    "input, textarea, select, [contenteditable='true'], [role='listbox'], [role='menu'], [role='dialog']"
  )
}

/**
 * Registers level hotkeys. Listens in the capture phase so a bound key
 * (e.g. D = Dispatch) does not also reach the global "d = dark mode" toggle.
 */
export function useHotkeys(keys: Hotkey[]) {
  const ref = useRef(keys)

  useEffect(() => {
    ref.current = keys
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      if (isEditable(e.target)) return
      const k = e.key.toLowerCase()
      const hit = ref.current.find((h) => h.key === k)
      if (!hit) return
      e.preventDefault()
      e.stopPropagation()
      if (!hit.disabled) hit.run()
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [])
}
