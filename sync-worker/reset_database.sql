-- D1 Full Reset Script
-- Warning: This will delete ALL data in your production database!

-- 1. Wipe everything
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS users;

-- 2. Re-create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Backlog user ID
  name TEXT,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Re-create profiles table (with owner_id)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT, -- Backlog user ID
  name TEXT,
  content TEXT, -- JSON serialized profile data (ProjectProfile type)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- 4. Create index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON profiles(owner_id);
