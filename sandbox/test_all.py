import os
import requests
from dotenv import load_dotenv

# Load keys from .env
load_dotenv()

def test_service(name, test_fn):
    print(f"--- Testing {name} ---")
    try:
        result = test_fn()
        print(f"{result}\n")
    except Exception as e:
        print(f"⚠️ Error: {str(e)}\n")

def test_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    resp = requests.get(f"{url}/rest/v1/", headers=headers)
    return "✅ Success" if resp.status_code == 200 else f"❌ Failed ({resp.status_code})"

def test_minimax():
    key = os.getenv("MINIMAX_API_KEY")
    url = "https://api.minimax.io/v1/music_generation"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    resp = requests.post(url, headers=headers, json={})
    # 2013 is 'invalid params' (means auth passed but body empty)
    return "✅ Success (Auth Passed)" if '"status_code":2013' in resp.text else f"❌ Failed: {resp.text[:100]}"

def test_grok():
    key = os.getenv("GROK_API_KEY")
    url = "https://api.x.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    data = {"model": "grok-2", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1}
    resp = requests.post(url, headers=headers, json=data)
    if resp.status_code == 200: return "✅ Success"
    if "Model not found" in resp.text: return "✅ Success (Auth Passed, Model Name needs update)"
    return f"❌ Failed ({resp.status_code})"

def test_telegram():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    resp = requests.get(f"https://api.telegram.org/bot{token}/getMe")
    if resp.status_code == 200:
        return f"✅ Success (@{resp.json()['result']['username']})"
    return f"❌ Failed ({resp.status_code})"

def test_github():
    token = os.getenv("GITHUB_PAT")
    headers = {"Authorization": f"token {token}"}
    resp = requests.get("https://api.github.com/user", headers=headers)
    if resp.status_code == 200:
        return f"✅ Success ({resp.json()['login']})"
    return f"❌ Failed ({resp.status_code})"

if __name__ == "__main__":
    print("🚀 Running Comprehensive System Test...\n")
    test_service("Supabase", test_supabase)
    test_service("Minimax", test_minimax)
    test_service("Grok (xAI)", test_grok)
    test_service("Telegram", test_telegram)
    test_service("GitHub", test_github)
