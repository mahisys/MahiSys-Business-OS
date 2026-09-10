/**
 * KRN-10 service errors. Shape matches `ErrorResponseSchema`
 * (`@mahisys/shared`). Duplicated from the other kernel modules' identical
 * class rather than imported cross-module, consistent with Vol 6 §7.
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
