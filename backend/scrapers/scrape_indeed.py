import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv
from config import get_jobs_collection

# Load .env variables
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

def scrape():
    collection = get_jobs_collection()
    # Remove any existing Indeed jobs before a fresh scrape
    deleted = collection.delete_many({"source": "Indeed"})
    print(f"Deleted {deleted.deleted_count} existing Indeed job documents from MongoDB")
    api_key = os.getenv("RAPIDAPI_KEY")
    if not api_key:
        print("ERROR: RAPIDAPI_KEY is missing from your .env file!")
        # Fallback template message for the user
        print("Please add RAPIDAPI_KEY=your_key_here inside backend/scrapers/.env")
        return 0
        
    url = "https://jsearch.p.rapidapi.com/search-v2"
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }
    
    all_jobs = []
    
    print("Starting Indeed scraper via JSearch RapidAPI...")
    for page in range(1, 26):
        print(f"Fetching JSearch API page {page}...")
        params = {
            "query": "software developer jobs in India",
            "page": str(page),
            "num_pages": "1"
        }
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=20)
            if response.status_code != 200:
                print(f"API returned error code {response.status_code} on page {page}: {response.text}")
                break
                
            res_data = response.json()
            jobs = res_data.get("data", {}).get("jobs", [])
            
            if not jobs:
                print(f"No jobs returned on page {page}.")
                break
                
            for item in jobs:
                # Format location cleanly
                loc_parts = []
                city = item.get("job_city")
                state = item.get("job_state")
                country = item.get("job_country", "India")
                if city:
                    loc_parts.append(city)
                if state:
                    loc_parts.append(state)
                if not loc_parts:
                    loc_parts.append(country)
                location = ", ".join(loc_parts)
                
                # Parse posting date
                posted_date = item.get("job_posted_at_datetime_utc", "")
                if posted_date:
                    # Clean datetime ISO string to simple date
                    posted_date = posted_date.split("T")[0]
                else:
                    posted_date = "N/A"
                
                # Format salary info for stipend field
                min_sal = item.get("job_min_salary")
                max_sal = item.get("job_max_salary")
                period = item.get("job_salary_period")
                currency = item.get("job_salary_currency", "INR")
                stipend = "Not Disclosed"
                if min_sal and max_sal:
                    stipend = f"{currency} {min_sal} - {max_sal} / {period}"
                elif min_sal:
                    stipend = f"{currency} {min_sal} / {period}"

                job_data = {
                    "job_title": item.get("job_title", "N/A"),
                    "company_name": item.get("employer_name", "N/A"),
                    "location": location,
                    "job_url": item.get("job_apply_link", "N/A"),
                    "date_posted": posted_date,
                    "job_description_snippet": item.get("job_description", "")[:300] + "..." if item.get("job_description") else "N/A"
                }
                # Build record for MongoDB / JSON
                record = {
                    "title": job_data["job_title"],
                    "company": job_data["company_name"],
                    "location": job_data["location"],
                    "stipend": stipend,
                    "duration": "Permanent",
                    "job_url": job_data["job_url"],
                    "source": "Indeed",
                    "scrapedAt": datetime.utcnow().isoformat(),
                    "date_posted": job_data["date_posted"],
                    "job_description_snippet": job_data["job_description_snippet"]
                }
                # Append to list for later deduplication and DB insert
                all_jobs.append(record)
                
            print(f"Page {page} done: parsed {len(jobs)} jobs")
            
        except Exception as e:
            print(f"Error requesting JSearch API on page {page}: {e}")
            break
            
    # Directly insert all fetched jobs into MongoDB (no deduplication)
    saved_count = 0
    for job in all_jobs:
        # Insert each job; using a copy to keep original dict clean for JSON dumping
        collection.insert_one(job.copy())
        saved_count += 1
    print(f"Inserted {saved_count} Indeed jobs into MongoDB")

    # Save results to indeed_jobs.json (all fetched jobs)
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "indeed_jobs.json")
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_jobs, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(all_jobs)} jobs to indeed_jobs.json successfully!")
    except Exception as e:
        print(f"Failed to write indeed_jobs.json: {e}")

    # Return stats
    print(f"Stats: fetched {len(all_jobs)} jobs, finally saved {saved_count} jobs.")
    return saved_count

if __name__ == "__main__":
    scrape()
