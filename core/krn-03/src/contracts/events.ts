/**
 * KRN-03 event contracts — KRN-03.md §12 (as extended during
 * implementation, see that file's header note on the three added events).
 */
import { z } from 'zod'
import { eventEnvelope, uuid } from '@mahisys/shared'

export const RoleCreatedPayloadSchema = z.object({ role_id: uuid, code: z.string() })
export const RoleCreatedEventSchema = eventEnvelope('access.role.created', RoleCreatedPayloadSchema)

export const RoleGrantedPayloadSchema = z.object({ permission_grant_id: uuid, subject_type: z.string(), subject_id: uuid })
export const RoleGrantedEventSchema = eventEnvelope('access.role.granted', RoleGrantedPayloadSchema)

export const RoleRevokedPayloadSchema = z.object({ permission_grant_id: uuid, subject_type: z.string(), subject_id: uuid })
export const RoleRevokedEventSchema = eventEnvelope('access.role.revoked', RoleRevokedPayloadSchema)

export const RoleDeprecatedPayloadSchema = z.object({ role_id: uuid, code: z.string() })
export const RoleDeprecatedEventSchema = eventEnvelope('access.role.deprecated', RoleDeprecatedPayloadSchema)

export const PermissionGrantExpiredPayloadSchema = z.object({ permission_grant_id: uuid, subject_type: z.string(), subject_id: uuid })
export const PermissionGrantExpiredEventSchema = eventEnvelope('access.permission_grant.expired', PermissionGrantExpiredPayloadSchema)

export const PermissionSetCreatedPayloadSchema = z.object({ permission_set_id: uuid, code: z.string() })
export const PermissionSetCreatedEventSchema = eventEnvelope('access.permission_set.created', PermissionSetCreatedPayloadSchema)

export const PermissionSetUpdatedPayloadSchema = z.object({ permission_set_id: uuid, code: z.string() })
export const PermissionSetUpdatedEventSchema = eventEnvelope('access.permission_set.updated', PermissionSetUpdatedPayloadSchema)

export const ScopeRuleChangedPayloadSchema = z.object({ data_scope_rule_id: uuid, superseded_id: uuid.nullable() })
export const ScopeRuleChangedEventSchema = eventEnvelope('access.scope_rule.changed', ScopeRuleChangedPayloadSchema)

export const FieldPolicyChangedPayloadSchema = z.object({ field_policy_id: uuid, superseded_id: uuid.nullable() })
export const FieldPolicyChangedEventSchema = eventEnvelope('access.field_policy.changed', FieldPolicyChangedPayloadSchema)

export const PolicyChangedPayloadSchema = z.object({ policy_type: z.enum(['scope_rule', 'field_policy']), policy_id: uuid })
export const PolicyChangedEventSchema = eventEnvelope('access.policy.changed', PolicyChangedPayloadSchema)

export const DelegationCreatedPayloadSchema = z.object({ delegation_id: uuid, from_subject_id: uuid, to_subject_id: uuid })
export const DelegationCreatedEventSchema = eventEnvelope('access.delegation.created', DelegationCreatedPayloadSchema)

export const DelegationStartedPayloadSchema = z.object({ delegation_id: uuid, from_subject_id: uuid, to_subject_id: uuid })
export const DelegationStartedEventSchema = eventEnvelope('access.delegation.started', DelegationStartedPayloadSchema)

export const DelegationExpiredPayloadSchema = z.object({ delegation_id: uuid, from_subject_id: uuid, to_subject_id: uuid })
export const DelegationExpiredEventSchema = eventEnvelope('access.delegation.expired', DelegationExpiredPayloadSchema)

export const DelegationRevokedPayloadSchema = z.object({ delegation_id: uuid, from_subject_id: uuid, to_subject_id: uuid })
export const DelegationRevokedEventSchema = eventEnvelope('access.delegation.revoked', DelegationRevokedPayloadSchema)
