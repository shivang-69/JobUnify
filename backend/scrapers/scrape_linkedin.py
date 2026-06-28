import os
import json
import time
import random
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from config import get_jobs_collection

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

def scrape():
    collection = get_jobs_collection()
    # Remove any old LinkedIn entries
    deleted = collection.delete_many({"source": "LinkedIn"})
    print(f"Deleted {deleted.deleted_count} existing LinkedIn jobs")

    base_url = (
        "https://www.linkedin.com/jobs/search/"
        "?keywords=software%20developer&location=India&f_TPR=r86400"
    )
    all_jobs = []
    page = 1
    while True:
        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "en-US,en;q=0.9",
        }
        url = f"{base_url}&start={(page - 1) * 25}"
        print(f"Fetching LinkedIn page {page}: {url}")
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                print(f"LinkedIn HTTP {resp.status_code}, stopping")
                break
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.select("li.result-card")
            if not cards:
                print("No job cards found – finished")
                break
            for card in cards:
                title_el = card.select_one("h3.result-card__title")
                company_el = card.select_one("h4.result-card__subtitle")
                loc_el = card.select_one("span.job-result-card__location")
                link_el = card.select_one("a.result-card__full-card-link")
                title = title_el.get_text(strip=True) if title_el else "N/A"
                company = company_el.get_text(strip=True) if company_el else "N/A"
                location = loc_el.get_text(strip=True) if loc_el else "N/A"
                job_url = link_el["href"] if link_el and link_el.has_attr("href") else ""
                job_data = {
                    "title": title,
                    "company": company,
                    "location": location,
                    "job_url": job_url,
                    "source": "LinkedIn",
                    "scrapedAt": datetime.utcnow().isoformat(),
                }
                collection.update_one(
                    {"job_url": job_url},
                    {"$set": job_data},
                    upsert=True,
                )
                all_jobs.append(job_data)
            print(f"Page {page} saved {len(cards)} jobs")
            page += 1
            time.sleep(2)
        except Exception as e:
            print(f"Error on LinkedIn page {page}: {e}")
            break
    # Dump JSON for debugging
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "linkedin_jobs.json")
    try:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(all_jobs, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(all_jobs)} LinkedIn jobs to {out_path}")
    except Exception as e:
        print(f"Failed to write LinkedIn JSON: {e}")
    return len(all_jobs)

if __name__ == "__main__":
    scrape()
