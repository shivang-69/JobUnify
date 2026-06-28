import json
import requests
from datetime import datetime
from dotenv import load_dotenv
import os

# Load environment variables from .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

def scrape():
    # Get Adzuna credentials
    ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
    ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY")

    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        raise RuntimeError("Adzuna credentials not found in .env")

    # Mongo collection helper
    from config import get_jobs_collection
    collection = get_jobs_collection()

    BASE_URL = "https://api.adzuna.com/v1/api/jobs/in/search"
    RESULTS_PER_PAGE = 50
    QUERY = "software developer"

    total_saved = 0
    all_jobs = []

    for page in range(1, 6):
        url = f"{BASE_URL}/{page}"
        params = {
            "app_id": ADZUNA_APP_ID,
            "app_key": ADZUNA_APP_KEY,
            "what": QUERY,
            "results_per_page": RESULTS_PER_PAGE,
            "content-type": "application/json"
        }
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"Failed to fetch page {page}: {e}")
            continue

        results = data.get("results", [])
        print(f"Page {page}: fetched {len(results)} jobs")
        for job in results:
            title = job.get("title")
            company = job.get("company", {}).get("display_name") if isinstance(job.get("company"), dict) else job.get("company")
            location = job.get("location", {}).get("display_name") if isinstance(job.get("location"), dict) else job.get("location")
            job_url = job.get("redirect_url")
            date_posted = job.get("created")
            description = job.get("description")

            job_data = {
                "title": title,
                "company": company,
                "location": location,
                "job_url": job_url,
                "date_posted": date_posted,
                "description": description,
                "source": "Naukri",
                "scrapedAt": datetime.utcnow().isoformat()
            }
            # Upsert using title, company, job_url as unique key
            collection.update_one(
                {"title": title, "company": company, "job_url": job_url},
                {"$set": job_data},
                upsert=True
            )
            total_saved += 1
            all_jobs.append(job_data)

    # Save to JSON file
    output_path = os.path.join(os.path.dirname(__file__), "naukri_jobs.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, ensure_ascii=False, indent=2)

    print(f"Total jobs saved: {total_saved}")
    return total_saved

if __name__ == "__main__":
    scrape()
