#!/bin/bash

# Replace with your actual deployed worker URL
WORKER_URL="https://music-worker.Niorlusx.workers.dev"

echo "Testing Deployed Music Worker..."

curl -X POST "$WORKER_URL" \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "Cyberpunk synthwave track, 120bpm",
       "lyrics": "[Verse] Neon lights in the rain [Chorus] Lost in the digital soul",
       "is_instrumental": false
     }'

echo -e "\n\nCheck your Cloudflare Logs or R2 Bucket in a few minutes to see the result!"
