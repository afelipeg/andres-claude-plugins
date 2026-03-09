// ─── User Repository ────────────────────────────────────────────────

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  scopes: string[];
  status: 'active' | 'invited' | 'deactivated';
  invite_token: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: Record<string, unknown>): UserRow {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    password_hash: row['password_hash'] as string,
    name: (row['name'] as string) ?? '',
    role: row['role'] as string,
    scopes: (row['scopes'] as string[]) ?? [],
    status: (row['status'] as UserRow['status']) ?? 'active',
    invite_token: (row['invite_token'] as string) ?? null,
    last_login_at: row['last_login_at'] ? String(row['last_login_at']) : null,
    created_at: String(row['created_at']),
    updated_at: String(row['updated_at']),
  };
}

export class UserRepo {
  constructor(private sql: unknown) {}

  async getByEmail(email: string): Promise<UserRow | null> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM users WHERE email = $1',
      [email],
    )) as Array<Record<string, unknown>>;
    return rows.length > 0 ? mapRow(rows[0]!) : null;
  }

  async getById(id: string): Promise<UserRow | null> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM users WHERE id = $1',
      [id],
    )) as Array<Record<string, unknown>>;
    return rows.length > 0 ? mapRow(rows[0]!) : null;
  }

  async getByInviteToken(token: string): Promise<UserRow | null> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      "SELECT * FROM users WHERE invite_token = $1 AND status = 'invited'",
      [token],
    )) as Array<Record<string, unknown>>;
    return rows.length > 0 ? mapRow(rows[0]!) : null;
  }

  async create(user: Omit<UserRow, 'created_at' | 'updated_at' | 'last_login_at'>): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO users (id, email, password_hash, name, role, scopes, status, invite_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        user.email,
        user.password_hash,
        user.name,
        user.role,
        JSON.stringify(user.scopes),
        user.status,
        user.invite_token,
      ],
    );
  }

  async upsert(user: Omit<UserRow, 'created_at' | 'updated_at' | 'last_login_at'>): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO users (id, email, password_hash, name, role, scopes, status, invite_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         scopes = EXCLUDED.scopes,
         status = EXCLUDED.status,
         invite_token = EXCLUDED.invite_token,
         updated_at = now()`,
      [
        user.id,
        user.email,
        user.password_hash,
        user.name,
        user.role,
        JSON.stringify(user.scopes),
        user.status,
        user.invite_token,
      ],
    );
  }

  async updateRole(id: string, role: string, scopes: string[]): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE users SET role = $1, scopes = $2, updated_at = now() WHERE id = $3',
      [role, JSON.stringify(scopes), id],
    );
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
      [passwordHash, id],
    );
  }

  async updateName(id: string, name: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE users SET name = $1, updated_at = now() WHERE id = $2',
      [name, id],
    );
  }

  async updateLastLogin(id: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1',
      [id],
    );
  }

  async deactivate(id: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      "UPDATE users SET status = 'deactivated', updated_at = now() WHERE id = $1",
      [id],
    );
  }

  async activate(id: string, passwordHash: string, name: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `UPDATE users SET status = 'active', password_hash = $1, name = $2,
       invite_token = NULL, updated_at = now() WHERE id = $3`,
      [passwordHash, name, id],
    );
  }

  async delete(id: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe('DELETE FROM users WHERE id = $1', [id]);
  }

  async listAll(limit = 100): Promise<UserRow[]> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1',
      [limit],
    )) as Array<Record<string, unknown>>;
    return rows.map(mapRow);
  }
}
