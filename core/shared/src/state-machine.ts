/**
 * Small reusable helper for the simple per-entity lifecycle state machines
 * used throughout the kernel (e.g. KRN-01's `tenant.status`,
 * `fiscal_period.status`, `isolation_assignment.migration_status`) before
 * KRN-05 (Process Engine) exists to formalise state machines generally.
 * Every module's own `*_TRANSITIONS` map is just `Record<State, State[]>`;
 * this function checks legality against one.
 */
export function isValidTransition<S extends string>(
  transitions: Record<S, S[]>,
  from: S,
  to: S,
): boolean {
  return transitions[from]?.includes(to) ?? false
}

/** All states declared as reachable targets from at least one other state, plus every key — i.e. the full state set. */
export function allStates<S extends string>(transitions: Record<S, S[]>): S[] {
  return Object.keys(transitions) as S[]
}

/** States with no outgoing transitions — terminal states. */
export function terminalStates<S extends string>(transitions: Record<S, S[]>): S[] {
  return allStates(transitions).filter((s) => transitions[s].length === 0)
}
