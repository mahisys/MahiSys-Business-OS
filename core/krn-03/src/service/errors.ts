/**
 * KRN-03 service errors. Shape matches `ErrorResponseSchema`
 * (`@mahisys/shared`). Duplicated from KRN-01/02/04's identical class
 * rather than imported cross-module, consistent with Vol 6 §7 ("a module
 * directory contains no reference to another module's internals").
 */
export class KernelError extends Error {
  code: string
  traceId: string
  details?: Record<string, unknown>

  constructor(code: string, message: string, traceId: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'KernelError'
    this.code = code
    this.traceId = traceId
    this.details = details
  }
}

export class NotImplementedError extends Error {
  constructor(fn: string) {
    super(`${fn} is not yet implemented (Vol 6 §6 step 3/4: written as a failing test first)`)
    this.name = 'NotImplementedError'
  }
}
