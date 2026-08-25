import requests
from bs4 import BeautifulSoup
import random
import time
from datetime import datetime
from config import get_jobs_collection

def parse_internshala_posted_date(text):
    import re
    from datetime import datetime, timedelta
    now = datetime.now()
    text = text.lower().strip()
    
    if "hour" in text or "minute" in text or "today" in text or "just now" in text:
        return now.strftime("%Y-%m-%d")
    
    match = re.search(r'(\d+)\s+day', text)
    if match:
        days = int(match.group(1))
        return (now - timedelta(days=days)).strftime("%Y-%m-%d")
        
    match = re.search(r'(\d+)\s+week', text)
    if match:
        weeks = int(match.group(1))
        return (now - timedelta(weeks=weeks)).strftime("%Y-%m-%d")
        
    match = re.search(r'(\d+)\s+month', text)
    if match:
        months = int(match.group(1))
        return (now - timedelta(days=months * 30)).strftime("%Y-%m-%d")
        
    return now.strftime("%Y-%m-%d")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

def scrape():
    collection = get_jobs_collection()
    jobs_saved = 0
    print("Starting Internshala scraper...")
    
    # Clear out old/expired Internshala jobs (excluding saved jobs)
    try:
        db = collection.database
        from config import get_saved_job_ids
        saved_ids = list(get_saved_job_ids(db))
        deleted = collection.delete_many({
            "source": "Internshala",
            "_id": {"$nin": saved_ids}
        })
        print(f"Cleared {deleted.deleted_count} stale Internshala jobs from DB (excluding saved jobs).")
    except Exception as e:
        print(f"Failed to clear old jobs: {e}")

    for page in range(1, 6):
        url = f"https://internshala.com/internships/page-{page}/"
        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                print(f"Failed to fetch page {page}: Status code {response.status_code}")
                continue
                
            soup = BeautifulSoup(response.text, "html.parser")
            cards = soup.select(".individual_internship")
            
            page_saved = 0
            for card in cards:
                try:
                    # 1. Title
                    title_el = card.select_one(".job-internship-name") or card.select_one(".profile")
                    if not title_el:
                        continue
                    
                    # 1.5 Quick expiration check
                    card_text = card.get_text().lower()
                    if "applications are closed" in card_text or "expired" in card_text:
                        continue

                    title = title_el.get_text(strip=True)
                    
                    # 2. Company
                    company_el = card.select_one(".company-name") or card.select_one(".company_name")
                    company = company_el.get_text(strip=True) if company_el else "N/A"
                    
                    # 3. Location
                    loc_el = card.select_one(".location_names") or card.select_one("#location_names")
                    location = loc_el.get_text(strip=True) if loc_el else "Remote"
                    
                    # 4. Stipend
                    stip_el = card.select_one(".stipend")
                    stipend = stip_el.get_text(strip=True) if stip_el else "Unpaid"
                    
                    # 5. Duration
                    # Duration is usually inside an item_body container
                    # We can find duration specifically by looking at the parent/sibling labels, 
                    # but let's grab it or fallback
                    duration = "3 Months"
                    item_bodies = card.select(".item_body")
                    if len(item_bodies) > 1:
                        # On Internshala, the order of info is usually: Start Date, Duration, Stipend
                        # Let's clean the duration text from the second item_body
                        duration = item_bodies[1].get_text(strip=True)
                    elif len(item_bodies) == 1:
                        duration = item_bodies[0].get_text(strip=True)
                    
                    # 6. Link
                    # Find the anchor tag that contains the internship detail URL
                    link_el = None
                    for a in card.find_all('a', href=True):
                        if '/internship/detail/' in a['href']:
                            link_el = a
                            break
                    job_url = ""
                    if link_el and link_el.has_attr('href'):
                        href = link_el['href']
                        job_url = f"https://internshala.com{href}" if href.startswith('/') else href
                    
                    # Insert job
                    date_posted = "N/A"
                    labels = card.select(".detail-row-2 .color-labels div")
                    if labels:
                        relative_date = labels[0].get_text(strip=True)
                        date_posted = parse_internshala_posted_date(relative_date)

                    job_data = {
                        "title": title,
                        "company": company,
                        "location": location,
                        "stipend": stipend,
                        "duration": duration,
                        "link": job_url,
                        "job_url": job_url,
                        "source": "Internshala",
                        "scrapedAt": datetime.now(),
                        "date_posted": date_posted
                    }
                    
                    # Upsert to prevent duplicate key issue on same run
                    collection.update_one(
                        {"job_url": job_url},
                        {"$set": job_data},
                        upsert=True
                    )
                    page_saved += 1
                    jobs_saved += 1
                except Exception as e:
                    print(f"Error parsing card: {e}")
                    
            print(f"Page {page} done: {page_saved} jobs saved")
            time.sleep(2)
            
        except Exception as e:
            print(f"Error scraping page {page}: {e}")
            
    print(f"Internshala scraping completed. Total saved: {jobs_saved}")
    return jobs_saved

if __name__ == "__main__":
    scrape()
