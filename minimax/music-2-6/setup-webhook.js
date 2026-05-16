/**
 * setup-webhook.js: A script to register the Cloudflare Worker URL as the Telegram Bot Webhook.
 * Usage: node setup-webhook.js <WORKER_URL> <BOT_TOKEN>
 */

const workerUrl = process.argv[2];
const botToken = process.argv[3];

if (!workerUrl || !botToken) {
    console.error("Usage: node setup-webhook.js <WORKER_URL> <BOT_TOKEN>");
    console.error("Example: node setup-webhook.js https://music-worker.your-subdomain.workers.dev/telegram-webhook YOUR_BOT_TOKEN");
    process.exit(1);
}

async function setWebhook() {
    const url = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(workerUrl)}`;
    console.log(`Setting webhook to: ${workerUrl}...`);
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.ok) {
            console.log("✅ Webhook successfully set!");
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.error("❌ Failed to set webhook.");
            console.error(JSON.stringify(result, null, 2));
        }
    } catch (err) {
        console.error("❌ Error making request:", err.message);
    }
}

setWebhook();
