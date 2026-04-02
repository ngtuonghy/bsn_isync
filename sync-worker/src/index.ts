import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database } from '@cloudflare/workers-types';

type User = {
  id: string;
  name: string;
  email: string | null;
};

type Bindings = {
  DB: D1Database;
};

type Variables = {
  user: User;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Enable CORS for all routes
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'X-Backlog-Host'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Auth Middleware: Verify Backlog Token
const authMiddleware = async (c: any, next: any) => {
  // Always skip auth for OPTIONS requests (CORS preflight)
  if (c.req.method === 'OPTIONS') {
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  const host = c.req.header('X-Backlog-Host');

  if (!authHeader || !authHeader.startsWith('Bearer ') || !host) {
    console.error('Auth check: Missing headers', { authHeader: !!authHeader, host });
    return c.json({ error: 'Missing authentication' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // Verify token with Backlog
    const backlogUrl = `https://${host}/api/v2/users/myself`;
    const response = await fetch(backlogUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Auth failed with Backlog (${backlogUrl}): Status ${response.status}`, errorText);
      return c.json({ 
        error: 'Auth failed', 
        details: `Backlog returned ${response.status}`,
        host: host
      }, 401);
    }

    const userData = await response.json() as any;
    const user = {
      id: userData.id.toString(),
      name: userData.name,
      email: userData.mailAddress
    };

    // Upsert user to D1
    await c.env.DB.prepare(
      'INSERT INTO users (id, name, email) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET name=?2, email=?3'
    ).bind(user.id, user.name, user.email).run();

    c.set('user', user);
    await next();
  } catch (e: any) {
    console.error('Internal Auth Error:', e.message);
    return c.json({ error: 'Internal Server Error (Auth)', message: e.message }, 500);
  }
};

// Apply auth to all /api/v1 routes
app.use('/api/v1/*', authMiddleware);

// GET /api/v1/profiles - Get profiles METADATA ONLY (anyone can see)
app.get('/api/v1/profiles', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, owner_id, name, version, updated_at FROM profiles
    `).all();

    return c.json(results);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/v1/profiles/:id - Get a single profile
app.get('/api/v1/profiles/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const profile = await c.env.DB.prepare(`
      SELECT * FROM profiles WHERE id = ?1
    `).bind(id).first();

    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json(profile);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/v1/profiles/:id/history - Get profile version history
app.get('/api/v1/profiles/:id/history', async (c) => {
  const id = c.req.param('id');
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT ph.*, u.name as modifier_name 
      FROM profile_history ph
      JOIN users u ON ph.modifier_id = u.id
      WHERE profile_id = ?1
      ORDER BY version DESC
    `).bind(id).all();

    return c.json(results);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/v1/profiles - Upsert a profile with version check (Optimistic Locking)
app.post('/api/v1/profiles', async (c) => {
  const user = c.get('user') as any;
  const body = await c.req.json() as any;
  const { id, name, content, version } = body;

  if (!id || !name || !content) {
    return c.json({ error: 'Missing id, name or content' }, 400);
  }

  try {
    // Check if profile exists
    const existing = await c.env.DB.prepare('SELECT owner_id, version FROM profiles WHERE id = ?1')
      .bind(id).first() as any;

    if (existing) {
      // If it exists, only the owner can update it
      if (existing.owner_id !== user.id) {
        return c.json({ error: 'No permission to edit this profile. Only the owner can make changes.' }, 403);
      }

      // Optimistic Locking: Client version must match current server version
      // (Exception: if client sends version 0 or undefined, maybe they're trying to overwrite? 
      // Better to enforce version for robustness.)
      if (version !== undefined && version !== existing.version) {
        return c.json({ 
          error: 'Conflict: Version mismatch', 
          server_version: existing.version,
          client_version: version
        }, 409);
      }
    }

    const nextVersion = existing ? (existing.version + 1) : 1;
    const contentStr = JSON.stringify(content);

    // Atomic transaction: Update profile and insert history
    // Since D1 batch is supported:
    const stmts = [
      c.env.DB.prepare(
        'INSERT INTO profiles (id, owner_id, name, content, version, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=?3, content=?4, version=?5, updated_at=CURRENT_TIMESTAMP'
      ).bind(id, user.id, name, contentStr, nextVersion),
      
      c.env.DB.prepare(
        'INSERT INTO profile_history (profile_id, content, version, modifier_id) VALUES (?1, ?2, ?3, ?4)'
      ).bind(id, contentStr, nextVersion, user.id)
    ];

    await c.env.DB.batch(stmts);

    return c.json({ success: true, version: nextVersion });
  } catch (e: any) {
    console.error('Upsert Error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// DELETE /api/v1/profiles/:id - Delete a profile
app.delete('/api/v1/profiles/:id', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');

  try {
    const existing = await c.env.DB.prepare('SELECT owner_id FROM profiles WHERE id = ?1')
      .bind(id).first() as any;

    if (!existing) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    // Only owner can delete
    if (existing.owner_id !== user.id) {
      return c.json({ error: 'Only the owner can delete this profile' }, 403);
    }

    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM profile_history WHERE profile_id = ?1').bind(id),
      c.env.DB.prepare('DELETE FROM profiles WHERE id = ?1').bind(id)
    ]);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
