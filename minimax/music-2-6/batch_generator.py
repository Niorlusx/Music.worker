import requests
import json
import time

# --- CONFIGURATION ---
WORKER_URL = "https://music-worker.Niorlusx.workers.dev"
TELEGRAM_CHAT_ID = "YOUR_CHAT_ID"  # Optional: Leave empty if not using
# ---------------------

album_tracks = [
    {
        "prompt": "Cinematic dark ambient trap intro, heavy brass, slow build into fast triplet rap. 142 BPM.",
        "lyrics": "[Verse] Locked in the room with the neon lights / Chrome on my braids and the fangs in sight / They tried to dim it, I made it bright / GNOVA the name, I’m the soul of the night! [Chorus] From the ward to the top, we don't never stop!"
    },
    {
        "prompt": "High-energy club trap, sharp synth lead, aggressive 808s, bouncing hi-hats. 150 BPM.",
        "lyrics": "[Verse] Pink on the chrome, yeah the style is the crop / Triplets on triplets, I'm hitting the swap / Melbourne to Atlanta, we making it hop / GNOVA the legend, I'm never gon' stop!"
    },
    {
        "prompt": "Cold aggressive drill-trap hybrid, dark piano loop, cold atmosphere. 148 BPM.",
        "lyrics": "[Verse] Fangs in the AC, it's cold in the room / Pink braids dancing, I'm bringing the doom / Resilience the motor, I'm clearing the gloom / From the ward to the top, I'm making it bloom!"
    },
    {
        "prompt": "Motivational anthem trap, epic choir, heavy kicks, triumphant feel. 152 BPM.",
        "lyrics": "[Chorus] They thought I was locked, I was just unlocking / Now the whole world is the one that is knocking / Ward to the top, yeah the boat is a-rocking / GNOVA the icon, there ain't no more blocking!"
    },
    {
        "prompt": "Fast technical trap, rapid-fire triplets, distorted bass, high energy. 155 BPM.",
        "lyrics": "[Verse] Triplet flow heavy, I'm hitting the mark / GNOVA the flame, I'm killing the dark / Chrome on the braids, yeah I'm leaving a spark / Rising above 'em, I'm running the park!"
    },
    {
        "prompt": "Atmospheric melodic trap, reverb-heavy vocals, energetic drop. 145 BPM.",
        "lyrics": "[Verse] White walls padded, but the vision is clear / Turning the struggle to something they fear / Pink in the aesthetic, the legend is here / GNOVA the sovereign, the end of the tier!"
    },
    {
        "prompt": "Bouncy Atlanta trap, high-pitched synth, rhythmic bass. 146 BPM.",
        "lyrics": "[Chorus] Skrrt in the flight, yeah we crossing the sea / Melbourne to A-Town, the spirit is free / Nobody doing it better than me / This is the life that they wanted to see!"
    },
    {
        "prompt": "Gritty underground trap, industrial synths, hard-hitting 808s. 150 BPM.",
        "lyrics": "[Verse] Stacks in the safe and the chrome on the whip / I took the struggle and changed up the script / Pink braids flowing, the style is a trip / GNOVA the giant, I'm taking the ship!"
    },
    {
        "prompt": "High-velocity trap, chaotic energy, heavy bass, rhythmic triplets. 154 BPM.",
        "lyrics": "[Verse] Resistant to sedatives, I'm staying awake / Building the empire for everyone's sake / Fangs in the mirror, there's no more mistake / GNOVA the winner, the power I take!"
    },
    {
        "prompt": "Triumphant orchestral trap outro, fading into heavy melodic beat. 140 BPM.",
        "lyrics": "[Outro] Admission to discharge, the story is told / From the white walls to the platinum and gold / GNOVA the resilient, the brave and the bold / Ward to the top, watch the future unfold!"
    }
]

def generate_album():
    print(f"🚀 Starting Batch Generation for GNOVA - 'Ward To The Top'...")
    for i, track in enumerate(album_tracks, 1):
        print(f"📦 Sending Track {i}/10: {track['prompt'][:50]}...")
        
        payload = {
            "prompt": track["prompt"],
            "lyrics": track["lyrics"],
            "telegram_chat_id": TELEGRAM_CHAT_ID
        }
        
        try:
            response = requests.post(WORKER_URL, json=payload)
            if response.status_code == 200:
                print(f"   ✅ Success: {response.json()['message']}")
            else:
                print(f"   ❌ Failed: {response.text}")
        except Exception as e:
            print(f"   ⚠️ Error: {str(e)}")
        
        # Small sleep to avoid overwhelming the queue
        time.sleep(1)

    print("\n✨ All tracks have been queued! Check your Telegram or R2 Bucket for the results.")

if __name__ == "__main__":
    generate_album()
