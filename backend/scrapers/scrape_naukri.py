import json
import requests
from datetime import datetime
from dotenv import load_dotenv
import os
import re
import time
from bs4 import BeautifulSoup

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

    # Clear out old/expired Adzuna jobs so we are only serving fresh listings (excluding saved jobs)
    try:
        db = collection.database
        from config import get_saved_job_ids
        saved_ids = list(get_saved_job_ids(db))
        deleted = collection.delete_many({
            "source": "Naukri",
            "_id": {"$nin": saved_ids}
        })
        print(f"Cleared {deleted.deleted_count} stale Naukri/Adzuna jobs from DB (excluding saved jobs).")
    except Exception as e:
        print(f"Failed to clear old jobs: {e}")

    BASE_URL = "https://api.adzuna.com/v1/api/jobs/in/search"
    RESULTS_PER_PAGE = 50
    QUERY = "developer"

    total_saved = 0
    all_jobs = []

    # Whitelist/Blacklist Regexes for first-pass details fetching
    cs_whitelist = re.compile(
        r'software|developer|programmer|engineer|frontend|backend|full\s*stack|'
        r'data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|'
        r'machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|'
        r'it\s*support|tech\s*support|android|ios|web|coder|react|node|'
        r'python|java|javascript|c\+\+|golang|php|laravel|angular|vue|'
        r'django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|'
        r'infrastructure|network|systems\s*administrator|it\s*admin',
        re.IGNORECASE
    )
    cs_blacklist = re.compile(
        r'mechanical|civil|electrical|electronics|chemical|structural|'
        r'sales|marketing|hr|human\s*resources|finance|accountant|'
        r'content\s*writer|copywriter|social\s*media|graphic|'
        r'telecaller|tele-caller|adviser|advisor|customer\s*care|'
        r'relationship\s*manager|sales\s*exec|business\s*development|'
        r'bde|recruiter',
        re.IGNORECASE
    )
    seniority_blacklist = re.compile(
        r'\bsenior\b|\bsr\b|\blead\b|\bmanager\b|\barchitect\b|\bprincipal\b|\bdirector\b|\bhead\b|\bexpert\b|\bvp\b|\bavp\b|\bgm\b|\bdgm\b|\bem\b|\bchief\b|\bmid-level\b|\bmid\s+level\b|\bmid\b|\bintermediate\b',
        re.IGNORECASE
    )

    for page in range(1, 16):
        url = f"{BASE_URL}/{page}"
        params = {
            "app_id": ADZUNA_APP_ID,
            "app_key": ADZUNA_APP_KEY,
            "what": QUERY,
            "category": "it-jobs",
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
            title = job.get("title") or ""
            company = job.get("company", {}).get("display_name") if isinstance(job.get("company"), dict) else job.get("company")
            location = job.get("location", {}).get("display_name") if isinstance(job.get("location"), dict) else job.get("location")
            job_url = job.get("redirect_url")
            date_posted = job.get("created")
            if date_posted:
                date_posted = date_posted.split("T")[0]
            else:
                date_posted = "N/A"
            description = job.get("description") or ""

            # Initialize experience_raw for EVERY job (fixes scoping bug)
            experience_raw = ""

            # Check if this job passes CS/IT and title seniority blacklist to fetch full description
            if cs_whitelist.search(title) and not cs_blacklist.search(title) and not seniority_blacklist.search(title):
                job_id = job.get("id")
                if job_id:
                    details_url = f"https://www.adzuna.in/details/{job_id}"

                    # Retry with exponential backoff on 429
                    max_retries = 3
                    for attempt in range(max_retries):
                        try:
                            headers = {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                                "Accept-Language": "en-US,en;q=0.5",
                                "Referer": "https://www.google.com/"
                            }
                            delay = 3 * (2 ** attempt)  # 3s, 6s, 12s
                            time.sleep(delay)
                            details_resp = requests.get(details_url, headers=headers, timeout=15)

                            if details_resp.status_code == 429:
                                print(f"  Rate limited (429) for {job_id}, retry {attempt+1}/{max_retries}...")
                                continue  # retry with longer delay

                            if details_resp.status_code == 200:
                                soup = BeautifulSoup(details_resp.text, 'html.parser')
                                desc_body = soup.select_one(".adp-body")
                                if desc_body:
                                    full_desc = desc_body.get_text(separator="\n", strip=True)
                                    description = full_desc

                                    # Extract experience info from the full description
                                    exp_patterns = [
                                        r'Experience\s*:\s*\d+(?:\.\d+)?\s*[-to]\s*\d+(?:\.\d+)?\s*Years?',
                                        r'Experience\s*:\s*\d+(?:\.\d+)?\s*\+?\s*Years?',
                                        r'\d+\s*(?:to|-)\s*\d+\s*years?\s*(?:of\s*)?experience',
                                        r'experience\s*(?:of\s*)?\d+\s*(?:to|-)\s*\d+\s*years?',
                                        r'\d+\+?\s*years?\s*(?:of\s*)?experience',
                                    ]
                                    for pat in exp_patterns:
                                        exp_match = re.search(pat, full_desc, re.IGNORECASE)
                                        if exp_match:
                                            experience_raw = exp_match.group().strip()
                                            break
                                else:
                                    # Fallback: search raw HTML for experience text
                                    for pat in [
                                        r'Experience\s*:\s*\d+(?:\.\d+)?\s*[-to]\s*\d+(?:\.\d+)?\s*Years?',
                                        r'\d+\+?\s*years?\s*(?:of\s*)?experience',
                                    ]:
                                        exp_match = re.search(pat, details_resp.text, re.IGNORECASE)
                                        if exp_match:
                                            experience_raw = exp_match.group().strip()
                                            break

                            break  # success or non-429 error, stop retrying

                        except Exception as e:
                            print(f"Failed to fetch details for {job_id} (attempt {attempt+1}): {e}")
                            break  # don't retry on network errors

            job_track = "internship" if ("internship" in (job_url or "").lower() or "internship" in (title or "").lower() or "intern" in (title or "").lower()) else "full-time"
            job_data = {
                "title": title,
                "company": company,
                "location": location,
                "job_url": job_url,
                "date_posted": date_posted,
                "description": description,
                "experience_raw": experience_raw,
                "job_track": job_track,
                "source": "Naukri",
                "scrapedAt": datetime.utcnow()
            }
            # Upsert using title, company, job_url as unique key
            try:
                collection.update_one(
                    {"title": title, "company": company, "job_url": job_url},
                    {"$set": job_data},
                    upsert=True
                )
                total_saved += 1
                all_jobs.append(job_data)
            except Exception as mongo_err:
                print(f"Mongo error for {title}: {mongo_err}")

    # Save to JSON file
    output_path = os.path.join(os.path.dirname(__file__), "naukri_jobs.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, ensure_ascii=False, indent=2)

    print(f"Total jobs saved: {total_saved}")
    return total_saved

if __name__ == "__main__":
    scrape()
