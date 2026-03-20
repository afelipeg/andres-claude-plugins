// ─── JWT Token Management ───────────────────────────────────────────

import * as jose from 'jose';
import type { AuthPayload, Role } from '@openagency/types';

const ALG = 'HS256';
const DEFAULT_EXPIRY = '1h';

function getSecret(secret?: string): Uint8Array {
  const raw = secret ?? process.env['JWT_SECRET'];
  if (!raw) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(raw);
}

export async function signToken(
  payload: { sub: string; role: Role; scopes: string[]; agency_id?: string },
  options?: { secret?: string; expiresIn?: string },
): Promise<string> {
  const secret = getSecret(options?.secret);
  return new jose.SignJWT({
    role: payload.role,
    scopes: payload.scopes,
    ...(payload.agency_id ? { agency_id: payload.agency_id } : {}),
  } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(options?.expiresIn ?? DEFAULT_EXPIRY)
    .setIssuer('openagency')
    .sign(secret);
}

export async function verifyToken(
  token: string,
  secret?: string,
): Promise<AuthPayload> {
  const key = getSecret(secret);
  const { payload } = await jose.jwtVerify(token, key, { issuer: 'openagency' });
  return {
    sub: payload.sub ?? '',
    role: (payload as Record<string, unknown>)['role'] as Role,
    scopes: (payload as Record<string, unknown>)['scopes'] as string[],
    iat: payload.iat ?? 0,
    exp: payload.exp ?? 0,
    agency_id: (payload as Record<string, unknown>)['agency_id'] as string | undefined,
  };
}

export async function decodeToken(token: string): Promise<jose.JWTPayload> {
  return jose.decodeJwt(token);
}
