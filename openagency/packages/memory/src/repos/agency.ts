// ─── Agency Repository ─────────────────────────────────────────────
// CRUD for the agencies table (first-class multi-tenant entity).

export interface AgencyRow {
  id: string;
  name: string;
  brand_count: number;
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

function mapRow(r: Record<string, unknown>): AgencyRow {
  return {
    id: r['id'] as string,
    name: r['name'] as string,
    brand_count: Number(r['brand_count'] ?? 1),
    status: (r['status'] as AgencyRow['status']) ?? 'active',
    created_at: String(r['created_at']),
    updated_at: String(r['updated_at']),
  };
}

export class AgencyRepo {
  constructor(private db: unknown) {}

  private get sql(): Db {
    return this.db as Db;
  }

  async findById(id: string): Promise<AgencyRow | null> {
    const rows = await this.sql.unsafe('SELECT * FROM agencies WHERE id = $1', [id]);
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? mapRow(r) : null;
  }

  async findAll(): Promise<AgencyRow[]> {
    const rows = await this.sql.unsafe('SELECT * FROM agencies ORDER BY created_at DESC', []);
    return (rows as Array<Record<string, unknown>>).map(mapRow);
  }

  async create(agency: { id: string; name: string; brand_count?: number }): Promise<void> {
    await this.sql.unsafe(
      'INSERT INTO agencies (id, name, brand_count) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [agency.id, agency.name, agency.brand_count ?? 1],
    );
  }

  async updateBrandCount(id: string, brandCount: number): Promise<void> {
    await this.sql.unsafe(
      'UPDATE agencies SET brand_count = $1, updated_at = now() WHERE id = $2',
      [brandCount, id],
    );
  }

  async updateName(id: string, name: string): Promise<void> {
    await this.sql.unsafe(
      'UPDATE agencies SET name = $1, updated_at = now() WHERE id = $2',
      [name, id],
    );
  }

  async delete(id: string): Promise<void> {
    await this.sql.unsafe("UPDATE agencies SET status = 'deleted', updated_at = now() WHERE id = $1", [id]);
  }

  /** Resolve agency_id for a user (via users.agency_id) */
  async resolveForUser(userId: string): Promise<string | null> {
    const rows = await this.sql.unsafe('SELECT agency_id FROM users WHERE id = $1', [userId]);
    const r = (rows as Array<Record<string, unknown>>)[0];
    return (r?.['agency_id'] as string) ?? null;
  }
}
