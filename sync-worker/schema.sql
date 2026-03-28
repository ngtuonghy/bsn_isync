CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Backlog user ID
  name TEXT,
  email TEXT,
  host TEXT, -- Backlog host (e.g., xxx.backlog.jp)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT, -- Backlog user ID
  name TEXT,
  content TEXT, -- JSON serialized profile data (ProjectProfile type)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS permissions (
  profile_id TEXT,
  user_id TEXT, -- Backlog user ID
  role TEXT, -- 'owner', 'editor', 'viewer'
  PRIMARY KEY (profile_id, user_id),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
