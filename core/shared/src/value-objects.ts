/**
 * Shared value objects, defined once and used everywhere per Vol 2 §1.4.
 * Never redefined by a module.
 */
import { z } from 'zod'
import { uuid } from './universal-fields.js'

export const MoneySchema = z.object({
  amount: z.string().regex(/^-?\d+(\.\d{1,4})?$/, 'decimal(18,4)'),
  currency: z.string().length(3), // ISO 4217
  exchange_rate: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  base_amount: z.string().regex(/^-?\d+(\.\d{1,4})?$/, 'decimal(18,4)').optional(),
})
export type Money = z.infer<typeof MoneySchema>

export const QuantitySchema = z.object({
  value: z.string().regex(/^-?\d+(\.\d{1,6})?$/, 'decimal(18,6)'),
  uom_id: uuid,
  base_value: z.string().regex(/^-?\d+(\.\d{1,6})?$/, 'decimal(18,6)').optional(),
  base_uom_id: uuid.optional(),
})
export type Quantity = z.infer<typeof QuantitySchema>

export const AddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  district: z.string().optional(),
  state_code: z.string().min(1),
  country_code: z.string().length(2), // ISO 3166-1 alpha-2
  pincode: z.string().min(1),
  geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
  type: z.enum(['registered', 'billing', 'shipping', 'branch', 'other']),
  is_primary: z.boolean(),
})
export type Address = z.infer<typeof AddressSchema>

export const ContactChannelSchema = z.object({
  type: z.enum(['email', 'phone', 'whatsapp']),
  value: z.string().min(1),
  verified: z.boolean(),
  consent: z.boolean(),
  is_primary: z.boolean(),
})
export type ContactChannel = z.infer<typeof ContactChannelSchema>

export const PeriodSchema = z.object({
  from: z.string().date(),
  to: z.string().date().nullable(),
  is_open_ended: z.boolean(),
}).refine(
  (p) => p.is_open_ended === (p.to === null),
  { message: 'Period.to must be null iff is_open_ended is true' },
)
export type Period = z.infer<typeof PeriodSchema>

/** Computed by CMP-01, never by a module (L7) — this schema describes the shape only. */
export const TaxContextSchema = z.object({
  place_of_supply: z.string(),
  tax_treatment: z.string(),
  hsn_sac: z.string(),
  rate_set_id: uuid,
  reverse_charge: z.boolean(),
})
export type TaxContext = z.infer<typeof TaxContextSchema>

export const AttachmentSchema = z.object({
  document_id: uuid, // points to KRN-08 file
  role: z.string(),
  caption: z.string().optional(),
})
export type Attachment = z.infer<typeof AttachmentSchema>

export const AuditNoteSchema = z.object({
  at: z.string().datetime(),
  by: uuid,
  note: z.string(),
  visibility: z.enum(['internal', 'shared']),
})
export type AuditNote = z.infer<typeof AuditNoteSchema>

export const GeoStampSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().nonnegative(),
  captured_at: z.string().datetime(),
  device_id: uuid,
})
export type GeoStamp = z.infer<typeof GeoStampSchema>
