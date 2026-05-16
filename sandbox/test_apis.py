import os
import requests
import json

def test_supabase(url, key):
    print("--- Testing Supabase ---")
    if not url or not key or "YOUR_" in url:
        print("❌ Skipped: Credentials not provided.")
        return
    try:
        # Simple health check/auth test by trying to read schema
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        resp = requests.get(f"{url}/rest/v1/", headers=headers)
        if resp.status_code == 200:
            print("✅ Success: Connection established.")
        else:
            print(f"❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"⚠️ Error: {str(e)}")

def test_minimax(key):
    print("\n--- Testing Minimax ---")
    if not key or "mock" in key:
        print("❌ Skipped: API key not provided.")
        return
    try:
        # Minimax doesn't have a simple 'whoami', we'll try a dummy generation request
        # or a minimal valid call if available. Using a generic endpoint for auth check.
        url = "https://api.minimax.io/v1/music_generation"
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        # Sending empty body to see if it rejects for auth or bad request
        resp = requests.post(url, headers=headers, json={})
        # If status is 401/403, auth failed. If 400, auth likely passed but payload was bad.
        if resp.status_code == 400:
             print("✅ Success: Authentication passed (rejected due to empty payload as expected).")
        elif resp.status_code in [401, 403]:
             print(f"❌ Failed: Authentication error ({resp.status_code}).")
        else:
             print(f"❓ Status: {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        print(f"⚠️ Error: {str(e)}")

def test_grok(key):
    print("\n--- Testing Grok (xAI) ---")
    if not key:
        print("❌ Skipped: API key not provided.")
        return
    try:
        url = "https://api.x.ai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        # Minimal request
        data = {
            "model": "grok-beta",
            "messages": [{"role": "user", "content": "say test"}],
            "max_tokens": 1
        }
        resp = requests.post(url, headers=headers, json=data)
        if resp.status_code == 200:
            print("✅ Success: Authentication passed.")
        else:
            print(f"❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"⚠️ Error: {str(e)}")

def test_telegram(token):
    print("\n--- Testing Telegram Bot ---")
    if not token or "mock" in token:
        print("❌ Skipped: Token not provided.")
        return
    try:
        url = f"https://api.telegram.org/bot{token}/getMe"
        resp = requests.get(url)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Success: Bot found - @{data['result']['username']}")
        else:
            print(f"❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"⚠️ Error: {str(e)}")

if __name__ == "__main__":
    # Attempt to load from environment or prompt user
    print("🚀 API Key Verification Script\n")
    
    s_url = os.getenv("SUPABASE_URL")
    s_key = os.getenv("SUPABASE_ANON_KEY")
    m_key = os.getenv("MINIMAX_API_KEY")
    g_key = os.getenv("GROK_API_KEY")
    t_token = os.getenv("TELEGRAM_BOT_TOKEN")

    test_supabase(s_url, s_key)
    test_minimax(m_key)
    test_grok(g_key)
    test_telegram(t_token)
