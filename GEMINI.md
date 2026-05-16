# Music Maker Project Instructions

## Architecture
- **Primary Service**: Cloudflare Workers.
- **Components**:
  - `my-music-worker`: Text-to-Audio (Whisper) worker with Supabase task logging.
  - `minimax/music-2-6`: Music generation worker using Minimax and Grok APIs, with R2 storage and Supabase tracking.
- **Backend**: Supabase (Database + Task State Management).
- **Storage**: Cloudflare R2 (`music-storage-bucket`).
- **Messaging**: Cloudflare Queues (`my-queue`).

## Workflows & Conventions
- **Deployment**: ALWAYS deploy via GitHub Actions. Local deployment from Termux is unsupported due to `workerd` binary incompatibility.
- **Database**: Maintain schemas in `supabase_schema.sql`.
- **Secrets Management**: Store API keys (Minimax, Grok, Telegram, Supabase) in GitHub Secrets.

## Technical Details
- Model for `my-music-worker`: `gemini-1.5-flash` (Text-to-Speech).
- Model for `music-2-6`: `gemini-1.5-pro` (Lyria Music Generation).
- **AI Provider**: Google Gemini API (Single key for all services).
