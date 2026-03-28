import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database } from '@cloudflare/workers-types';

type User = {
  id: string;
  name: string;
  email: string | null;
  host: string;
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
    return c.json({ error: 'Missing authentication' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // Verify token with Backlog
    const response = await fetch(`https://${host}/api/v2/users/myself`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      return c.json({ error: 'Auth failed' }, 401);
    }

    const userData = await response.json() as any;
    const user = {
      id: userData.id.toString(),
      name: userData.name,
      email: userData.mailAddress,
      host: host
    };

    // Upsert user to D1
    await c.env.DB.prepare(
      'INSERT INTO users (id, name, email, host) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET name=?2, email=?3, host=?4'
    ).bind(user.id, user.name, user.email, user.host).run();

    c.set('user', user);
    await next();
  } catch (e: any) {
    console.error('Auth error:', e);
    return c.json({ error: 'Internal Server Error (Auth)' }, 500);
  }
};

// Apply auth to all /api/v1 routes
app.use('/api/v1/*', authMiddleware);

// GET /api/v1/profiles - Get all accessible profiles
app.get('/api/v1/profiles', async (c) => {
  const user = c.get('user') as any;

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT p.*, perm.role 
      FROM profiles p
      JOIN permissions perm ON p.id = perm.profile_id
      WHERE perm.user_id = ?1
    `).bind(user.id).all();

    return c.json(results);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/v1/profiles - Upsert a profile
app.post('/api/v1/profiles', async (c) => {
  const user = c.get('user') as any;
  const body = await c.req.json() as any;
  const { id, name, content } = body;

  if (!id || !name || !content) {
    return c.json({ error: 'Missing name or content' }, 400);
  }

  try {
    // Check if profile exists and user has permission (if updating)
    const existing = await c.env.DB.prepare('SELECT role FROM permissions WHERE profile_id = ?1 AND user_id = ?2')
      .bind(id, user.id).first() as any;

    if (existing && existing.role === 'viewer') {
      return c.json({ error: 'No permission to edit' }, 403);
    }

    // Upsert profile
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO profiles (id, owner_id, name, content, updated_at) VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=?3, content=?4, updated_at=CURRENT_TIMESTAMP'
      ).bind(id, user.id, name, JSON.stringify(content)),
      // Auto-assign owner role if new
      c.env.DB.prepare(
        'INSERT OR IGNORE INTO permissions (profile_id, user_id, role) VALUES (?1, ?2, "owner")'
      ).bind(id, user.id)
    ]);

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// DELETE /api/v1/profiles/:id - Delete a profile
app.delete('/api/v1/profiles/:id', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');

  try {
    // Only owner can delete
    const perm = await c.env.DB.prepare('SELECT role FROM permissions WHERE profile_id = ?1 AND user_id = ?2')
      .bind(id, user.id).first() as any;

    if (!perm || perm.role !== 'owner') {
      return c.json({ error: 'Only owner can delete' }, 403);
    }

    await c.env.DB.prepare('DELETE FROM profiles WHERE id = ?1').bind(id).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/v1/profiles/:id/share - Manage permissions
app.post('/api/v1/profiles/:id/share', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  const { targetUserId, role } = await c.req.json() as any; // role: 'editor' | 'viewer' | 'remove'

  if (!targetUserId || !role) {
    return c.json({ error: 'Missing targetUserId or role' }, 400);
  }

  try {
    // Only owner can share
    const perm = await c.env.DB.prepare('SELECT role FROM permissions WHERE profile_id = ?1 AND user_id = ?2')
      .bind(id, user.id).first() as any;

    if (!perm || perm.role !== 'owner') {
      return c.json({ error: 'Only owner can share' }, 403);
    }

    if (role === 'remove') {
      if (targetUserId === user.id) return c.json({ error: 'Cannot remove self' }, 400);
      await c.env.DB.prepare('DELETE FROM permissions WHERE profile_id = ?1 AND user_id = ?2')
        .bind(id, targetUserId).run();
    } else {
      await c.env.DB.prepare(
        'INSERT INTO permissions (profile_id, user_id, role) VALUES (?1, ?2, ?3) ON CONFLICT(profile_id, user_id) DO UPDATE SET role=?3'
      ).bind(id, targetUserId, role).run();
    }

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
