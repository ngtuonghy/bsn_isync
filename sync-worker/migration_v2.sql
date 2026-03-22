-- Migration script to add versioning and history
-- 1. Add version column to profiles
ALTER TABLE profiles ADD COLUMN version INTEGER DEFAULT 1;

-- 2. Create history table
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
