import requests
from bs4 import BeautifulSoup
import random
import time
from datetime import datetime
from config import get_jobs_collection

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

def scrape():
    collection = get_jobs_collection()
    jobs_saved = 0
    
    print("Starting Internshala scraper...")
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
                    job_data = {
                        "title": title,
                        "company": company,
                        "location": location,
                        "stipend": stipend,
                        "duration": duration,
                        "link": job_url,
                        "job_url": job_url,
                        "source": "Internshala",
                        "scrapedAt": datetime.now()
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
