/**
 * P-01..P-12 primitive catalogue — Vol 0 §6, verbatim. A fixed, closed set
 * (L2: "never define a business object that duplicates a primitive") —
 * `entity_definition.primitive_id` must be exactly one of these
 * (KRN-04-FR-001).
 */
import { z } from 'zod'

export const PrimitiveIdSchema = z.enum([
  'P-01', // Party
  'P-02', // Item
  'P-03', // Resource
  'P-04', // Location
  'P-05', // Document
  'P-06', // Transaction
  'P-07', // Process
  'P-08', // Event
  'P-09', // Record
  'P-10', // Agreement
  'P-11', // Measurement
  'P-12', // Rule
])
export type PrimitiveId = z.infer<typeof PrimitiveIdSchema>
