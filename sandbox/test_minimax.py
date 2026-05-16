import requests
import json
import os

KEY = os.getenv("MINIMAX_API_KEY")
URL = "https://api.minimax.io/v1/music_generation"

formats = [
    {"Authorization": f"Bearer {KEY}"},
    {"Authorization": KEY},
]

print(f"Testing Minimax Authentication Header Formats...")

for headers in formats:
    print(f"\nHeader: {headers}")
    try:
        resp = requests.post(URL, headers=headers, json={})
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")
    except Exception as e:
        print(f"Error: {str(e)}")
