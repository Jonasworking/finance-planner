/*
 * "Verstanden" on the ready-for-real-data card. Per device (localStorage): every new device or
 * browser should show its own checklist once.
 */
const KEY = 'fp.readyAcknowledged'

export function isReadyAcknowledged(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function acknowledgeReady(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Storage unavailable: the card shows again next time – harmless.
  }
}
