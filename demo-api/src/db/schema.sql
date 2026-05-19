PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS relics (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  personality TEXT NOT NULL,
  interaction TEXT NOT NULL,
  memory TEXT NOT NULL,
  cover_url TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relics_type ON relics(type);
CREATE INDEX IF NOT EXISTS idx_relics_updated_at ON relics(updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  relic_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (relic_id) REFERENCES relics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_relic_time ON chat_messages(relic_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS forge_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forge_tasks_status ON forge_tasks(status);
CREATE INDEX IF NOT EXISTS idx_forge_tasks_created_at ON forge_tasks(created_at DESC);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  width INTEGER,
  height INTEGER,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);
