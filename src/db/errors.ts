export type DomainErrorCode =
  | 'invalid-amount'
  | 'invalid-date'
  | 'not-a-monday'
  | 'not-found'
  | 'unknown-category'
  | 'unknown-pot'
  | 'archived'
  | 'same-pot'
  | 'non-positive'
  | 'insufficient'
  | 'income-missing'
  | 'week-closed'
  | 'primary-pot-protected'
  | 'pot-not-empty'
  | 'derived-transaction'
  | 'invalid-backup'
  | 'inconsistent-backup'
  | 'no-safety-copy'

/** A rule of the domain was violated; the write was rolled back. `code` drives the UI message. */
export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly details: string[]

  constructor(code: DomainErrorCode, message?: string, details: string[] = []) {
    super(message ?? code)
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }
}
