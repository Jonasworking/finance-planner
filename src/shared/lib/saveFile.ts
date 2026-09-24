import { isIOS } from './platform'

export type SaveResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Hands a file to the user. On iPhone the share sheet ("In Dateien sichern", AirDrop, Mail);
 * everywhere else a download – the Mac share sheet has no "save" target. Build the file BEFORE
 * the tap: iOS only allows `share()` while the tap's user activation is still fresh.
 * Cancelling the share sheet is not an error, but it is not a saved backup either.
 */
export async function saveFile(file: File): Promise<SaveResult> {
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // e.g. NotAllowedError (activation expired): fall back to a download below
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers read the blob only after the click handler returned.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'downloaded'
}
