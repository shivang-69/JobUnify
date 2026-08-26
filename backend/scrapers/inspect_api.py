import os
import json
import requests
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

def check_adzuna():
    ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
    ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY")
    if not ADZUNA_APP_ID:
        print("No Adzuna credentials")
        return
    url = "https://api.adzuna.com/v1/api/jobs/in/search/1"
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "what": "software developer",
        "results_per_page": 2,
        "content-type": "application/json"
    }
    resp = requests.get(url, params=params)
    if resp.status_code == 200:
        data = resp.json()
        print("Adzuna First Job Response Keys/Sample:")
        if data.get("results"):
            print(json.dumps(data["results"][0], indent=2))
        else:
            print("No Adzuna results")
    else:
        print("Adzuna error:", resp.status_code)

def check_internshala():
    url = "https://internshala.com/internships/page-1/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }
    resp = requests.get(url, headers=headers)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(resp.text, "html.parser")
    cards = soup.select(".individual_internship")
    print(f"\nInternshala found {len(cards)} cards on page 1")
    if cards:
        print("First card HTML sample:")
        print(str(cards[0])[:1000])

if __name__ == "__main__":
    check_adzuna()
    check_internshala()
