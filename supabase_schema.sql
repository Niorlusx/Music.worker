-- SQL Schema for Music Maker Project

-- 1. Table for 'my-music-worker' (Whisper/Task tracking)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    error TEXT
);

-- 2. Table for 'minimax/music-2-6' (Music Generation)
CREATE TABLE IF NOT EXISTS music_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt TEXT NOT NULL,
    optimized_prompt TEXT,
    lyrics TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    r2_key TEXT,
    file_id TEXT,
    error TEXT,
    is_instrumental BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime (optional, for dashboards)
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE music_tasks;
