// ─── Role-Based Access Control ──────────────────────────────────────

import type { Role } from '@openagency/types';

/** Scope hierarchy - which scopes each role gets by default */
const ROLE_SCOPES: Record<Role, string[]> = {
  super_admin: ['*'],
  agency_admin: ['admin:*', 'engine:*', 'connectors:*'],
  account_manager: ['engine:*', 'connectors:read', 'hfl:*', 'pipeline:*'],
  viewer: ['dashboard:read', 'scorecard:read', 'billing:read'],
  // Legacy roles (backward compat)
  admin: ['*'],
  engine_user: ['engine:*', 'connectors:read'],
  readonly: ['engine:*:read', 'connectors:read'],
  agent: ['engine:*'],
};

/**
 * Check if the given scopes permit the requested action.
 *
 * Scope patterns:
 *   - `*`                          → everything
 *   - `engine:*`                   → all engine actions
 *   - `engine:leak-detector`       → all leak-detector skills
 *   - `engine:leak-detector:waste-waterfall` → specific skill
 *   - `admin:*`                    → admin actions
 *   - `connectors:read`            → read connector data
 *   - `connectors:write`           → modify connectors
 */
export function hasScope(
  grantedScopes: string[],
  requiredScope: string,
): boolean {
  for (const scope of grantedScopes) {
    if (scope === '*') return true;
    if (scope === requiredScope) return true;

    // Wildcard matching: "engine:*" matches "engine:leak-detector"
    if (scope.endsWith(':*')) {
      const prefix = scope.slice(0, -1); // "engine:"
      if (requiredScope.startsWith(prefix)) return true;
    }
  }
  return false;
}

/** Get default scopes for a role */
export function getDefaultScopes(role: Role): string[] {
  return ROLE_SCOPES[role] ?? [];
}

/** Build the required scope string for an engine skill execution */
export function engineSkillScope(engineId: string, skillId?: string): string {
  if (skillId) return `engine:${engineId}:${skillId}`;
  return `engine:${engineId}`;
}

/** Check if a role can perform an action (using default scopes) */
export function roleHasPermission(role: Role, requiredScope: string): boolean {
  return hasScope(ROLE_SCOPES[role] ?? [], requiredScope);
}
