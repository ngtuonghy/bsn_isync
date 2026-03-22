-- D1 Full Reset Script (Version 2)
-- Warning: This will delete ALL data in your production database!

-- 1. Wipe everything
DROP TABLE IF EXISTS profile_history;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS users;

-- 2. Re-create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Backlog user ID
  name TEXT,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Re-create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT, -- Backlog user ID
  name TEXT,
  content TEXT, -- JSON serialized profile data
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- 4. Re-create history table
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

-- 5. Create index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON profiles(owner_id);
