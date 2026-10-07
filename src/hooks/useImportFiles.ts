import { useT } from '../i18n/useLang'
import { useToasts } from '../components/ToastContainer'
import { importFiles } from '../lib/importFiles'

/**
 * `importFiles` with a progress toast and a way to stop it. A single photo is quick enough
 * that a toast would only flash, so it shows from the second one on.
 */
export function useImportFiles() {
  const t = useT()
  const toast = useToasts()
  const reportHeic = (result: Awaited<ReturnType<typeof importFiles>>) => {
    if (result.skippedHeic) toast.warn(`${t('import.heicUnsupported')} (${result.skippedHeic})`)
    return result
  }
  return async (files: FileList, add: Parameters<typeof importFiles>[1]) => {
    if (files.length < 2) return reportHeic(await importFiles(files, add))
    const signal = { cancelled: false }
    const label = (done: number) => `${t('import.adding')} ${done}/${files.length}`
    const progress = toast.progress(label(1), {
      label: t('menu.cancel'),
      onClick: () => {
        signal.cancelled = true
        progress.done()
      },
    })
    try {
      return reportHeic(
        await importFiles(files, add, {
          signal,
          onProgress: (done, total) => progress.update(label(Math.min(done + 1, total))),
        }),
      )
    } finally {
      progress.done()
    }
  }
}
