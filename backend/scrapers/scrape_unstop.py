import requests
import time
from datetime import datetime
from config import get_jobs_collection

def scrape():
    collection = get_jobs_collection()
    jobs_saved = 0
    
    print("Starting Unstop scraper...")
    for page in range(1, 11):
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
                    job_url = f"https://unstop.com/{public_url}" if public_url else "https://unstop.com"
                    link = job_url
                    
                    job_data = {
                        "title": title,
                        "company": company,
                        "location": location,
                        "stipend": stipend,
                        "duration": duration,
                        "job_url": job_url,
                        "link": link,  # legacy field
                        "source": "Unstop",
                        "scrapedAt": datetime.now()
                    }
                    
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
