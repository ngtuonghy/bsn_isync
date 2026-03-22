CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Backlog user ID
  name TEXT,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT, -- Backlog user ID
  name TEXT,
  content TEXT, -- JSON serialized profile data (ProjectProfile type)
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS profile_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT,
  content TEXT,
  version INTEGER,
  modifier_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id),
  FOREIGN KEY (modifier_id) REFERENCES users(id)
);
