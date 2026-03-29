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

// GET /api/v1/profiles - Get ALL profiles (anyone can see)
app.get('/api/v1/profiles', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM profiles
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

// POST /api/v1/profiles - Upsert a profile
app.post('/api/v1/profiles', async (c) => {
  const user = c.get('user') as any;
  const body = await c.req.json() as any;
  const { id, name, content } = body;

  if (!id || !name || !content) {
    return c.json({ error: 'Missing id, name or content' }, 400);
  }

  try {
    // Check if profile exists
    const existing = await c.env.DB.prepare('SELECT owner_id FROM profiles WHERE id = ?1')
      .bind(id).first() as any;

    if (existing) {
      // If it exists, only the owner can update it
      if (existing.owner_id !== user.id) {
        return c.json({ error: 'No permission to edit this profile. Only the owner can make changes.' }, 403);
      }
    }

    // Upsert profile
    await c.env.DB.prepare(
      'INSERT INTO profiles (id, owner_id, name, content, updated_at) VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=?3, content=?4, updated_at=CURRENT_TIMESTAMP'
    ).bind(id, user.id, name, JSON.stringify(content)).run();

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
    const existing = await c.env.DB.prepare('SELECT owner_id FROM profiles WHERE id = ?1')
      .bind(id).first() as any;

    if (!existing) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    // Only owner can delete
    if (existing.owner_id !== user.id) {
      return c.json({ error: 'Only the owner can delete this profile' }, 403);
    }

    await c.env.DB.prepare('DELETE FROM profiles WHERE id = ?1').bind(id).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
