import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'

type Reporter = (error: unknown, action: string) => void

const WriteErrorContext = createContext<Reporter | null>(null)

/**
 * Surfaces failed database writes.
 *
 * Every mutation here is fire-and-forget from the component's point of view —
 * the live query redraws from whatever actually landed. That is fine until a
 * write rejects (storage quota, private browsing, an evicted database), at
 * which point the value silently reverts and the set you just logged is gone
 * with nothing on screen to say so. There is no server copy to reconcile
 * against later, so a silent failure here is permanent data loss.
 */
export function WriteErrorProvider({ children }: { children: ReactNode }) {
  const [failure, setFailure] = useState<{ action: string; message: string } | null>(null)

  const report = useCallback<Reporter>((error, action) => {
    const message = error instanceof Error ? error.message : String(error)
    // eslint-disable-next-line no-console
    console.error(`[workout] ${action} failed`, error)
    setFailure({ action, message })
  }, [])

  const value = useMemo(() => report, [report])

  return (
    <WriteErrorContext value={value}>
      {children}
      {failure ? (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-50 border-b border-red-800 bg-red-950 px-4 py-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <p className="text-sm font-semibold text-red-200">Could not save — {failure.action}</p>
          <p className="mt-1 text-xs text-red-300/80">
            {failure.message} Your last change was not recorded. Check available storage before
            carrying on.
          </p>
          <button
            type="button"
            className="mt-2 min-h-9 rounded-md bg-red-900 px-3 text-xs font-semibold text-red-100"
            onClick={() => setFailure(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </WriteErrorContext>
  )
}

/**
 * Returns a wrapper that reports rejections from a fire-and-forget write.
 * Usage: `save(updateSet(id, { reps }), 'updating a set')`.
 */
export function useWrite() {
  const report = use(WriteErrorContext)
  if (!report) throw new Error('useWrite must be used inside WriteErrorProvider')

  return useCallback(
    <T,>(promise: Promise<T>, action: string): Promise<T | undefined> =>
      promise.catch((error: unknown) => {
        report(error, action)
        return undefined
      }),
    [report],
  )
}
