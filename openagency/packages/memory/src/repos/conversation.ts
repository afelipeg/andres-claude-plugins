// ─── Conversation Repository ──────────────────────────────────────────
// Persists Plinth Assistant conversations + messages to PostgreSQL.

export interface ConvMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{ type: string; result: unknown }>;
  timestamp: string;
}

export interface ConversationRecord {
  id: string;
  user_id?: string;
  title: string;
  starred: boolean;
  run_id?: string;
  run_type: string;
  messages: ConvMessage[];
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  starred: boolean;
  run_id?: string;
  run_type: string;
  message_count: number;
  preview: string;
  created_at: string;
  updated_at: string;
}

export class ConversationRepo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  async save(conv: ConversationRecord): Promise<void> {
    // Upsert conversation row
    await this.db`
      INSERT INTO assistant_conversations
        (id, user_id, title, starred, run_id, run_type, message_count, created_at, updated_at)
      VALUES (
        ${conv.id}, ${conv.user_id ?? null}, ${conv.title}, ${conv.starred},
        ${conv.run_id ?? null}, ${conv.run_type}, ${conv.messages.length},
        ${conv.created_at}, ${conv.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        starred = EXCLUDED.starred,
        run_id = EXCLUDED.run_id,
        run_type = EXCLUDED.run_type,
        message_count = EXCLUDED.message_count,
        updated_at = EXCLUDED.updated_at
    `;

    // Upsert only new messages (skip existing by id)
    for (const msg of conv.messages) {
      await this.db`
        INSERT INTO assistant_messages (id, conversation_id, role, content, actions, created_at)
        VALUES (
          ${msg.id}, ${conv.id}, ${msg.role}, ${msg.content},
          ${msg.actions ? JSON.stringify(msg.actions) : null},
          ${msg.timestamp}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  async list(): Promise<ConversationSummary[]> {
    const rows = await this.db`
      SELECT
        c.id, c.title, c.starred, c.run_id, c.run_type, c.message_count,
        c.created_at, c.updated_at,
        (
          SELECT content FROM assistant_messages
          WHERE conversation_id = c.id AND role = 'user'
          ORDER BY created_at DESC LIMIT 1
        ) AS preview_content
      FROM assistant_conversations c
      ORDER BY c.starred DESC, c.updated_at DESC
      LIMIT 200
    ` as Array<{
      id: string; title: string; starred: boolean; run_id: string | null;
      run_type: string; message_count: number; created_at: Date; updated_at: Date;
      preview_content: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      starred: r.starred,
      run_id: r.run_id ?? undefined,
      run_type: r.run_type,
      message_count: r.message_count,
      preview: (r.preview_content ?? '').slice(0, 80),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    }));
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const convRows = await this.db`
      SELECT id, user_id, title, starred, run_id, run_type, message_count, created_at, updated_at
      FROM assistant_conversations WHERE id = ${id}
    ` as Array<{
      id: string; user_id: string | null; title: string; starred: boolean; run_id: string | null;
      run_type: string; message_count: number; created_at: Date; updated_at: Date;
    }>;

    const conv = convRows[0];
    if (!conv) return null;

    const msgRows = await this.db`
      SELECT id, role, content, actions, created_at
      FROM assistant_messages
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
    ` as Array<{
      id: string; role: 'user' | 'assistant'; content: string;
      actions: unknown; created_at: Date;
    }>;

    return {
      id: conv.id,
      user_id: conv.user_id ?? undefined,
      title: conv.title,
      starred: conv.starred,
      run_id: conv.run_id ?? undefined,
      run_type: conv.run_type,
      message_count: conv.message_count,
      created_at: conv.created_at instanceof Date ? conv.created_at.toISOString() : String(conv.created_at),
      updated_at: conv.updated_at instanceof Date ? conv.updated_at.toISOString() : String(conv.updated_at),
      messages: msgRows.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        actions: m.actions
          ? (m.actions as Array<{ type: string; result: unknown }>)
          : undefined,
        timestamp: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
      })),
    };
  }

  async patch(id: string, patch: { title?: string; starred?: boolean }): Promise<void> {
    if (patch.title !== undefined && patch.starred !== undefined) {
      await this.db`
        UPDATE assistant_conversations
        SET title = ${patch.title.slice(0, 100)}, starred = ${patch.starred}, updated_at = now()
        WHERE id = ${id}
      `;
    } else if (patch.title !== undefined) {
      await this.db`
        UPDATE assistant_conversations
        SET title = ${patch.title.slice(0, 100)}, updated_at = now()
        WHERE id = ${id}
      `;
    } else if (patch.starred !== undefined) {
      await this.db`
        UPDATE assistant_conversations
        SET starred = ${patch.starred}, updated_at = now()
        WHERE id = ${id}
      `;
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db`
      DELETE FROM assistant_conversations WHERE id = ${id}
    ` as { count: number };
    return (result.count ?? 0) > 0;
  }
}
