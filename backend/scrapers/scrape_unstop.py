import requests
import time
from datetime import datetime
from config import get_jobs_collection

def scrape():
    collection = get_jobs_collection()
    jobs_saved = 0
    print("Starting Unstop scraper...")
    
    # Clear out old/expired Unstop jobs (excluding saved jobs)
    try:
        db = collection.database
        from config import get_saved_job_ids
        saved_ids = list(get_saved_job_ids(db))
        deleted = collection.delete_many({
            "source": "Unstop",
            "_id": {"$nin": saved_ids}
        })
        print(f"Cleared {deleted.deleted_count} stale Unstop jobs from DB (excluding saved jobs).")
    except Exception as e:
        print(f"Failed to clear old jobs: {e}")

    for page in range(1, 16):
        url = "https://unstop.com/api/public/opportunity/search-result"
        params = {
            "opportunity": "jobs",
            "page": page,
            "size": 20
        }
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=15)
            if response.status_code != 200:
                print(f"Failed to fetch page {page}: Status code {response.status_code}")
                continue
                
            data = response.json()
            # Unstop response format usually has opportunity search results under data.data.data or data.records
            # Let's inspect typical structure
            records = []
            if "data" in data:
                inner_data = data["data"]
                if isinstance(inner_data, dict):
                    records = inner_data.get("data", [])
                elif isinstance(inner_data, list):
                    records = inner_data
            
            # Fallback check
            if not records and "records" in data:
                records = data["records"]
                
            page_saved = 0
            for item in records:
                try:
                    title = item.get("title", "")
                    if not title:
                        continue
                        
                    # Quick expiration check
                    status = str(item.get("status", "")).lower()
                    if status in ["closed", "expired", "inactive"]:
                        continue
                        
                    # Organization Name
                    org_info = item.get("organisation", {})
                    company = org_info.get("name", "N/A") if isinstance(org_info, dict) else "N/A"
                    
                    # Location handling (may be a dict or string)
                    location_raw = item.get("city", "")
                    if not location_raw:
                        locations = item.get("locations", [])
                        if locations:
                            location_raw = locations[0]
                    # If location_raw is a dict, flatten it
                    if isinstance(location_raw, dict):
                        city = location_raw.get('city', '')
                        state = location_raw.get('state', '')
                        country = location_raw.get('country', '')
                        location = f"{city}, {state}, {country}".strip(', ')
                    else:
                        location = location_raw or "Remote"
                    
                    # Salary/Stipend
                    stipend = item.get("salary", "")
                    if not stipend:
                        stipend = "Not Disclosed"
                        
                    # Job Type / Duration
                    job_type = item.get("job_type", "Full-time")
                    duration = "Permanent" if "job" in job_type.lower() else "3 Months"
                    
                    # Link and job_url
                    public_url = item.get("public_url", "")
                    
                    updated_at = item.get("updated_at")
                    date_posted = "N/A"
                    if updated_at:
                        date_posted = updated_at.split("T")[0]
                        
                    end_date = item.get("end_date")
                    expiration_date = None
                    if end_date:
                        expiration_date = end_date.split("T")[0]
                    
                    job_url = f"https://unstop.com/{public_url}" if public_url else "https://unstop.com"
                    link = job_url
                    
                    # Explicit experience info
                    job_detail = item.get("jobDetail") or {}
                    min_exp = job_detail.get("min_experience")
                    max_exp = job_detail.get("max_experience")
                    
                    job_data = {
                        "title": title,
                        "company": company,
                        "location": location,
                        "stipend": stipend,
                        "duration": duration,
                        "job_url": job_url,
                        "link": link,  # legacy field
                        "source": "Unstop",
                        "scrapedAt": datetime.now(),
                        "date_posted": date_posted,
                        "description": item.get("details", "")
                    }
                    if min_exp is not None:
                        job_data["min_experience"] = min_exp
                    if max_exp is not None:
                        job_data["max_experience"] = max_exp
                    if expiration_date:
                        job_data["expiration_date"] = expiration_date
                    
                    collection.update_one(
                        {"title": title, "company": company},
                        {"$set": job_data},
                        upsert=True
                    )
                    page_saved += 1
                    jobs_saved += 1
                except Exception as e:
                    print(f"Error parsing item: {e}")
                    
            print(f"Page {page} done: {page_saved} jobs saved")
            time.sleep(1)
            
        except Exception as e:
            print(f"Error scraping page {page}: {e}")
            
    print(f"Unstop scraping completed. Total saved: {jobs_saved}")
    return jobs_saved

if __name__ == "__main__":
    scrape()
