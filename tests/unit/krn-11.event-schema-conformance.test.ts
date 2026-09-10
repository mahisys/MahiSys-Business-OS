/**
 * KRN-11 event-schema conformance — same rationale as the other kernel
 * modules': runs the real service functions and validates actual emitted
 * events (now recorded through the real KRN-06 event store, not a local
 * stand-in — see decisions-taken.md D-39) against the real Zod schemas.
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { createSeries, closeSeries, rolloverSeries } from '@mahisys/krn-11'
import { allocate, confirmReservation, cancelReservation, cancelAllocatedNumber } from '@mahisys/krn-11'
import {
  SeriesCreatedEventSchema,
  SeriesClosedEventSchema,
  SeriesRolledOverEventSchema,
  NumberReservedEventSchema,
  NumberAllocatedEventSchema,
  NumberCancelledEventSchema,
} from '@mahisys/krn-11'
import { newStores, makeSeries, sysActor, userActor, TENANT_ID, LEGAL_ENTITY_ID } from './krn-11.fixtures.js'

const SCHEMA_BY_EVENT_NAME: Record<string, z.ZodTypeAny> = {
  'numbering.series.created': SeriesCreatedEventSchema,
  'numbering.series.closed': SeriesClosedEventSchema,
  'numbering.series.rolled_over': SeriesRolledOverEventSchema,
  'numbering.number.reserved': NumberReservedEventSchema,
  'numbering.number.allocated': NumberAllocatedEventSchema,
  'numbering.number.cancelled': NumberCancelledEventSchema,
}

describe('KRN-11 — every emitted event validates against its declared Zod schema, recorded through the real KRN-06 store', () => {
  it('exercises every KRN-11 mutation and checks each resulting event', () => {
    const { krn06, krn11 } = newStores()

    const series = makeSeries(krn11) // numbering.series.created
    const reservedSeries = makeSeries(krn11, { allocation_mode: 'on_draft_with_reservation' }) // numbering.series.created

    const alloc = allocate(krn11, { seriesId: series.id, idempotencyKey: 'e1' }, sysActor) // numbering.number.allocated
    cancelAllocatedNumber(krn11, series.id, alloc.sequenceValue, 'manual_correction', userActor, 'PR-16') // numbering.number.cancelled

    const reservation = allocate(krn11, { seriesId: reservedSeries.id, idempotencyKey: 'e2' }, sysActor) // numbering.number.reserved
    confirmReservation(krn11, reservation.allocationId, sysActor) // numbering.number.allocated

    const reservation2 = allocate(krn11, { seriesId: reservedSeries.id, idempotencyKey: 'e3' }, sysActor) // numbering.number.reserved
    cancelReservation(krn11, reservation2.allocationId, 'reservation_expired', sysActor) // numbering.number.cancelled

    const seriesToClose = makeSeries(krn11)
    closeSeries(krn11, seriesToClose.id, sysActor, 'PR-21') // numbering.series.closed

    const seriesToRollover = makeSeries(krn11)
    rolloverSeries(krn11, seriesToRollover.id, 'FY2029', userActor, 'PR-16') // numbering.series.closed + numbering.series.rolled_over

    expect(krn06.events.length).toBeGreaterThanOrEqual(11)

    const krn11Events = krn06.events.filter((e) => e.event_name.startsWith('numbering.'))
    expect(krn11Events.length).toBeGreaterThanOrEqual(11)

    for (const event of krn11Events) {
      const schema = SCHEMA_BY_EVENT_NAME[event.event_name]
      expect(schema, `no schema registered for emitted event_name "${event.event_name}"`).toBeDefined()
      const result = schema.safeParse(event)
      if (!result.success) {
        throw new Error(`Event ${event.event_name} does not match its declared schema: ${JSON.stringify(result.error.issues, null, 2)}`)
      }
    }

    // Sanity check on D-39's integration claim: these events are real rows in KRN-06's own event store, not a KRN-11-local array.
    expect(krn06.events.some((e) => e.event_name === 'numbering.series.created' && e.tenant_id === TENANT_ID && e.entity_id === LEGAL_ENTITY_ID)).toBe(true)
  })
})
