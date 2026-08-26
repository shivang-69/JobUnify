import os
import json
import requests
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv
from config import get_jobs_collection

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

def parse_relative_date(posted_at_str):
    """
    Parses a relative date string like '1 day ago', '3 days ago', 'yesterday'
    into a YYYY-MM-DD date string.
    """
    if not posted_at_str:
        return datetime.utcnow().strftime('%Y-%m-%d')
        
    s = posted_at_str.lower().strip()
    today = datetime.utcnow()
    
    if 'today' in s:
        return today.strftime('%Y-%m-%d')
    if 'yesterday' in s:
        return (today - timedelta(days=1)).strftime('%Y-%m-%d')
        
    # Match digits like "3 days ago" or "2 weeks ago"
    match = re.search(r'(\d+)\s*(day|week|month|hour)', s)
    if match:
        val = int(match.group(1))
        unit = match.group(2)
        if 'day' in unit:
            dt = today - timedelta(days=val)
        elif 'week' in unit:
            dt = today - timedelta(weeks=val)
        elif 'month' in unit:
            dt = today - timedelta(days=val * 30)
        elif 'hour' in unit:
            dt = today # same day
        else:
            dt = today
        return dt.strftime('%Y-%m-%d')
        
    return today.strftime('%Y-%m-%d')

def scrape():
    collection = get_jobs_collection()
    
    # Budget check: Only run once every 23 hours to stay within SerpApi free limits
    try:
        last_job = collection.find_one({"source": "GoogleJobs"}, sort=[("scrapedAt", -1)])
        if last_job and "scrapedAt" in last_job:
            last_scraped = last_job["scrapedAt"]
            # Handle string vs datetime timestamp format
            if isinstance(last_scraped, str):
                last_scraped = datetime.fromisoformat(last_scraped.replace("Z", "+00:00"))
            
            # Use timezone-naive comparison for simplicity
            last_scraped_naive = last_scraped.replace(tzinfo=None)
            if (datetime.utcnow() - last_scraped_naive) < timedelta(hours=23):
                print("Google Jobs was scraped less than 23 hours ago. Skipping to save SerpApi quota.")
                return 0
    except Exception as e:
        print(f"Warning: could not check last run budget: {e}")

    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        print("ERROR: SERPAPI_KEY is missing from your .env file!")
        return 0

    # Strict budget: 6 queries max (6 requests total)
    queries = [
        "software developer fresher jobs India",
        "backend developer entry level India",
        "frontend developer fresher India",
        "software engineer fresher jobs India",
        "web developer entry level India",
        "react developer fresher India"
    ]

    total_scraped = 0
    total_saved = 0
    total_collisions = 0
    
    seen_in_run = set() # Avoid inserting duplicates fetched within the same run

    print("Starting Google Jobs scraper via SerpApi...")
    for idx, q in enumerate(queries):
        print(f"Request {idx+1}/6: Querying '{q}'...")
        url = "https://serpapi.com/search"
        params = {
            "engine": "google_jobs",
            "q": q,
            "location": "India",
            "gl": "in",
            "api_key": api_key
        }

        try:
            resp = requests.get(url, params=params, timeout=20)
            if resp.status_code != 200:
                print(f"  SerpApi returned status {resp.status_code}: {resp.text}")
                continue

            data = resp.json()
            jobs = data.get("jobs_results", [])
            print(f"  Fetched {len(jobs)} jobs")

            for j in jobs:
                total_scraped += 1
                title = j.get("title")
                company = j.get("company_name")
                location = j.get("location")

                if not title or not company:
                    continue

                # Normalise keys for deduplication
                title_clean = title.strip().lower()
                company_clean = company.strip().lower()
                location_clean = (location or "").strip().lower()
                dedup_key = (title_clean, company_clean, location_clean)

                if dedup_key in seen_in_run:
                    continue
                seen_in_run.add(dedup_key)

                # Check if this job already exists in DB (deduplicate against all sources)
                existing = collection.find_one({
                    "title": {"$regex": f"^{re.escape(title.strip())}$", "$options": "i"},
                    "company": {"$regex": f"^{re.escape(company.strip())}$", "$options": "i"},
                    "location": {"$regex": f"^{re.escape(location or '')}$", "$options": "i"}
                })

                if existing:
                    total_collisions += 1
                    # print(f"  [Collision] skipped: '{title}' @ '{company}'")
                    continue

                # Map to existing job schema
                # Get direct apply link if available in apply_options
                job_url = j.get("share_link", "N/A")
                apply_options = j.get("apply_options", [])
                if apply_options and isinstance(apply_options, list):
                    # Prefer first direct link
                    job_url = apply_options[0].get("link", job_url)

                detected = j.get("detected_extensions", {}) or {}
                relative_posted = detected.get("posted_at")
                date_posted = parse_relative_date(relative_posted)

                schedule_type = detected.get("schedule_type", "Full-time")
                job_track = "internship" if ("internship" in (job_url or "").lower() or "internship" in (title or "").lower() or "intern" in (title or "").lower() or "internship" in schedule_type.lower()) else "full-time"

                record = {
                    "title": title,
                    "company": company,
                    "location": location or "India",
                    "stipend": "Not Disclosed",
                    "duration": schedule_type,
                    "job_url": job_url,
                    "source": "GoogleJobs",
                    "scrapedAt": datetime.utcnow(), # Native MongoDB Date
                    "date_posted": date_posted,
                    "description": j.get("description", "N/A"),
                    "job_track": job_track
                }

                # Save to MongoDB
                collection.insert_one(record)
                total_saved += 1

        except Exception as e:
            print(f"  Error querying SerpApi: {e}")
            continue

    print(f"\nGoogle Jobs Scraping Summary:")
    print(f"  Total Scraped in run: {total_scraped}")
    print(f"  Deduplication Collisions skipped: {total_collisions}")
    print(f"  New Unique Jobs Saved: {total_saved}")
    return total_saved

if __name__ == "__main__":
    scrape()
