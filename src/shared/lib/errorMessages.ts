/** German copy for the `code` of a DomainError (kept as plain strings: shared must not import db). */
const MESSAGES: Record<string, string> = {
  'invalid-amount': 'Bitte einen gültigen Betrag eingeben.',
  'invalid-date': 'Das Datum ist ungültig.',
  'invalid-rate': 'Bitte einen gültigen Kurs eingeben, z. B. 0,61.',
  'not-a-monday': 'Eine Woche muss an einem Montag beginnen.',
  'not-found': 'Der Eintrag existiert nicht mehr.',
  'unknown-category': 'Diese Kategorie gibt es nicht mehr.',
  'unknown-pot': 'Diesen Topf gibt es nicht mehr.',
  archived: 'Der Topf ist archiviert.',
  'same-pot': 'Quelle und Ziel sind derselbe Topf.',
  'non-positive': 'Der Betrag muss größer als 0 sein.',
  insufficient: 'So viel ist in diesem Topf nicht vorhanden.',
  'income-missing': 'Bitte zuerst das Einkommen der Woche eintragen.',
  'week-closed': 'Die Woche ist bereits abgeschlossen.',
  'primary-pot-protected': '„Nur gespart" kann nicht archiviert werden.',
  'pot-not-empty': 'Der Topf muss leer sein, bevor er archiviert wird.',
  'derived-transaction': 'Diese Buchung folgt automatisch aus einer Woche oder Ausgabe.',
  'invalid-backup': 'Die Datei ist kein gültiges Backup.',
  'inconsistent-backup': 'Das Backup ist in sich nicht stimmig.',
  'no-safety-copy': 'Es gibt keine Sicherheitskopie.',
}

export function errorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return MESSAGES[code] ?? 'Das hat nicht geklappt. Bitte noch einmal versuchen.'
}
