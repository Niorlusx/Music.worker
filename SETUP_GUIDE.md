# 🎵 Music Maker Setup Guide

All code changes have been implemented and pushed to GitHub. Follow these remaining steps to go live.

## 1. Supabase Database Setup
Copy the content of `supabase_schema.sql` (located in the project root) and paste it into the **SQL Editor** in your Supabase Dashboard. This will create the `tasks` and `music_tasks` tables.

## 2. GitHub Secrets Configuration
Go to your GitHub repository: `Settings > Secrets and variables > Actions`.
Add the following **Repository Secrets**:

| Secret Name | Description |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API Token (Edit Workers permission) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |
| `MINIMAX_API_KEY` | Your Minimax API Key |
| `GROK_API_KEY` | Your xAI (Grok) API Key |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot Token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your Telegram Chat ID |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase Anon/Public Key |

## 3. Cloudflare Infrastructure
Ensure you have created these in your Cloudflare dashboard:
- **R2 Bucket**: Named `music-storage-bucket`.
- **Queue**: Named `my-queue`.

## 4. Run the Album Generator
Once the GitHub Action (Deployment) is complete, run the generator from this terminal:
```bash
python minimax/music-2-6/batch_generator.py
```

## 5. Monitor
- **Database**: Watch the `music_tasks` table in Supabase for real-time status updates.
- **Storage**: Generated MP3s will appear in your Cloudflare R2 bucket.
- **Telegram**: Your bot will send a notification once each track is ready.
