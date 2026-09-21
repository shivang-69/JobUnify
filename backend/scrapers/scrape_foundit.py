import os
import sys
import re
import time
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from curl_cffi import requests

# Add parent scrapers dir to sys.path for config import
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import get_jobs_collection

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

SITEMAP_URL = "https://www.foundit.in/xmlsitemap/todays-jobs-sitemap.xml"

# Browser headers matching Chrome 128 on Windows
BROWSER_HEADERS = {
    'authority': 'www.foundit.in',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'max-age=0',
    'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 JobUnify/1.0'
}

# CS/IT slug keywords for high-relevance pre-filtering
CS_SLUG_KEYWORDS = [
    'developer', 'engineer', 'software', 'programmer', 'frontend', 'backend',
    'fullstack', 'full-stack', 'react', 'python', 'java', 'node', 'data-scientist',
    'data-analyst', 'data-engineer', 'devops', 'sdet', 'qa', 'quality-assurance',
    'cloud', 'cyber', 'security', 'android', 'ios', 'web', 'coder', 'golang',
    'php', 'laravel', 'flutter', 'machine-learning', 'artificial-intelligence'
]

# Slug blacklist for non-CS/IT jobs
NON_CS_SLUG_BLACKLIST = [
    'mechanical', 'civil', 'chemical', 'structural', 'electrical', 'electronics',
    'sales', 'marketing', 'human-resources', 'recruiter', 'finance', 'accountant',
    'telecaller', 'customer-care', 'territory-business', 'business-development', 'bde'
]

def parse_foundit_date(date_str):
    """
    Parses date format from Foundit (often DD-MM-YYYY or ISO format) to YYYY-MM-DD.
    """
    if not date_str:
        return datetime.utcnow().strftime('%Y-%m-%d')
        
    date_str = date_str.strip()
    # Check DD-MM-YYYY
    match_dmy = re.match(r'^(\d{2})-(\d{2})-(\d{4})', date_str)
    if match_dmy:
        day, month, year = match_dmy.groups()
        return f"{year}-{month}-{day}"
        
    # Check YYYY-MM-DD
    match_ymd = re.match(r'^(\d{4})-(\d{2})-(\d{2})', date_str)
    if match_ymd:
        return match_ymd.group(0)
        
    return datetime.utcnow().strftime('%Y-%m-%d')

def fetch_sitemap_candidate_urls(limit=30):
    """
    Fetches the daily Foundit XML sitemap and returns tech job detail URLs.
    """
    print(f"Fetching sitemap from {SITEMAP_URL}...")
    try:
        resp = requests.get(SITEMAP_URL, headers=BROWSER_HEADERS, impersonate='chrome120', timeout=20)
        if resp.status_code != 200:
            print(f"::error title=Sitemap Fetch Failed::Foundit sitemap returned HTTP {resp.status_code}")
            raise RuntimeError(f"Foundit sitemap returned status {resp.status_code}")
            
        root = ET.fromstring(resp.content)
        all_urls = []
        for elem in root.iter():
            if elem.tag.endswith('loc') and elem.text:
                url = elem.text.strip()
                if '/job/' in url:
                    all_urls.append(url)
                    
        print(f"Sitemap parsed successfully. Found {len(all_urls)} total job URLs.")
        
        # Filter for CS/IT relevant slugs
        candidate_urls = []
        for u in all_urls:
            u_lower = u.lower()
            # Must match at least one CS keyword
            has_cs = any(kw in u_lower for kw in CS_SLUG_KEYWORDS)
            # Must NOT match non-CS blacklist
            has_blacklist = any(bl in u_lower for bl in NON_CS_SLUG_BLACKLIST)
            if has_cs and not has_blacklist:
                candidate_urls.append(u)
                
        print(f"Pre-filtered {len(candidate_urls)} CS/IT candidate URLs from sitemap.")
        return candidate_urls[:limit]
        
    except Exception as e:
        print(f"::error title=Sitemap Parse Error::Failed to parse Foundit sitemap: {e}")
        raise

def parse_job_page(url):
    """
    Fetches and parses a single Foundit job detail page.
    Returns (status_code, job_record or None).
    """
    try:
        resp = requests.get(url, headers=BROWSER_HEADERS, impersonate='chrome120', timeout=15)
        if resp.status_code != 200:
            return resp.status_code, None
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # 1. Primary: JSON-LD JobPosting schema
        job_data = None
        for s in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(s.string)
                if isinstance(data, dict) and data.get('@type') == 'JobPosting':
                    job_data = data
                    break
            except Exception:
                continue

        # Title
        title = ""
        if job_data and job_data.get('title'):
            title = job_data.get('title')
        elif soup.find('h1'):
            title = soup.find('h1').get_text(strip=True)
            
        # Company
        company = ""
        if job_data and isinstance(job_data.get('hiringOrganization'), dict):
            company = job_data['hiringOrganization'].get('name', '')
        elif soup.find(id='jgPageCompany'):
            company = soup.find(id='jgPageCompany').get_text(strip=True)
        elif soup.select_one('.jobMainInfoCard__companyLink'):
            company = soup.select_one('.jobMainInfoCard__companyLink').get_text(strip=True)
            
        if not title or not company:
            return 200, None

        # Location
        location = "India"
        if job_data and isinstance(job_data.get('jobLocation'), dict):
            addr = job_data['jobLocation'].get('address')
            if isinstance(addr, dict):
                loc_parts = [addr.get('addressLocality'), addr.get('addressRegion'), addr.get('addressCountry')]
                location = ", ".join([p for p in loc_parts if p])
            elif addr:
                location = str(addr)
                
        # Date posted
        raw_date = job_data.get('datePosted') if job_data else None
        date_posted = parse_foundit_date(raw_date)
        
        # Experience tag / requirements
        experience_raw = ""
        if job_data and isinstance(job_data.get('experienceRequirements'), dict):
            months = job_data['experienceRequirements'].get('monthsOfExperience')
            if months is not None:
                years = round(int(months) / 12)
                experience_raw = f"{years} Years" if years > 0 else "0 - 1 Years"
                
        # DOM badge check for experience tag (e.g. Fresher, 0-1 yrs)
        dom_exp = soup.find(string=re.compile(r'(\d+\s*-\s*\d+\s*years?|fresher|\d+\+\s*years?)', re.I))
        if dom_exp:
            dom_exp_clean = dom_exp.strip()
            if len(dom_exp_clean) <= 25:
                experience_raw = dom_exp_clean

        # Description (strip scripts, styles, HTML tags)
        clean_desc = ""
        if job_data and job_data.get('description'):
            desc_soup = BeautifulSoup(job_data.get('description'), 'html.parser')
            for bad_tag in desc_soup(['style', 'script', 'head']):
                bad_tag.decompose()
            clean_desc = desc_soup.get_text(separator='\n', strip=True)
        elif soup.select_one('.jobDescription__body'):
            clean_desc = soup.select_one('.jobDescription__body').get_text(separator='\n', strip=True)
        else:
            clean_desc = "N/A"
            
        # Employment Type & Track
        emp_type = (job_data.get('employmentType') if job_data else "") or ""
        job_track = "internship" if (
            "internship" in title.lower() or 
            "intern" in title.lower() or 
            "intern" in url.lower() or 
            "intern" in emp_type.lower()
        ) else "full-time"

        record = {
            "title": title.strip(),
            "company": company.strip(),
            "location": location.strip() or "India",
            "stipend": "Not Disclosed",
            "job_url": url,
            "source": "Foundit",
            "scrapedAt": datetime.utcnow(),
            "date_posted": date_posted,
            "description": clean_desc,
            "experience_raw": experience_raw,
            "job_track": job_track
        }
        return 200, record

    except Exception as e:
        # print(f"Error parsing {url}: {e}")
        return 500, None

def scrape(limit=25):
    """
    Main scraper execution.
    Fetches candidate URLs from the sitemap, parses job details,
    validates health check ratios, and upserts unique jobs to MongoDB.
    """
    print("========================================")
    print("Starting Foundit Sitemap Scraper...")
    print(f"Target batch limit: {limit} jobs")
    print("========================================\n")
    
    collection = get_jobs_collection()
    urls = fetch_sitemap_candidate_urls(limit=limit)
    if not urls:
        print("No candidate URLs found in sitemap.")
        return 0

    total_attempted = 0
    success_200 = 0
    blocked_403 = 0
    other_err = 0
    
    total_saved = 0
    total_collisions = 0
    all_scraped = []

    print(f"\nCrawling {len(urls)} job detail pages (1.5s delay between requests)...\n")
    for idx, u in enumerate(urls, 1):
        total_attempted += 1
        time.sleep(1.5) # Polite scraping delay
        
        status, record = parse_job_page(u)
        slug_preview = u.split('/')[-1][:40]
        
        if status == 200:
            success_200 += 1
            if record:
                # Deduplication check against MongoDB
                existing = collection.find_one({
                    "title": {"$regex": f"^{re.escape(record['title'])}$", "$options": "i"},
                    "company": {"$regex": f"^{re.escape(record['company'])}$", "$options": "i"},
                    "job_url": record['job_url']
                })
                
                if existing:
                    total_collisions += 1
                    print(f"[{idx}/{len(urls)}] [Collision] {record['title']} @ {record['company']}")
                else:
                    collection.update_one(
                        {"title": record['title'], "company": record['company'], "job_url": record['job_url']},
                        {"$set": record},
                        upsert=True
                    )
                    total_saved += 1
                    all_scraped.append(record)
                    print(f"[{idx}/{len(urls)}] [Saved] {record['title']} @ {record['company']} ({record['date_posted']})")
            else:
                print(f"[{idx}/{len(urls)}] [Empty/Unparsed] {slug_preview}")
        elif status == 403:
            blocked_403 += 1
            print(f"[{idx}/{len(urls)}] [HTTP 403 Access Denied] {slug_preview}")
        else:
            other_err += 1
            print(f"[{idx}/{len(urls)}] [HTTP {status}] {slug_preview}")

    # Health Check Calculation
    ratio_200 = (success_200 / total_attempted) * 100 if total_attempted > 0 else 0
    ratio_403 = (blocked_403 / total_attempted) * 100 if total_attempted > 0 else 0

    print("\n==================================================")
    print("FOUNDIT SCRAPER HEALTH CHECK REPORT")
    print("==================================================")
    print(f"Total URLs Attempted: {total_attempted}")
    print(f"HTTP 200 OK:          {success_200} ({ratio_200:.1f}%)")
    print(f"HTTP 403 (Blocked):   {blocked_403} ({ratio_403:.1f}%)")
    print(f"Other Errors:         {other_err}")
    print(f"New Jobs Saved to DB: {total_saved}")
    print(f"Duplicates Skipped:   {total_collisions}")
    print("==================================================\n")

    # Save local json record with default=str to avoid datetime errors
    output_path = os.path.join(os.path.dirname(__file__), "foundit_jobs.json")
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_scraped, f, ensure_ascii=False, indent=2, default=str)
    except Exception as e:
        print(f"Warning: Could not save foundit_jobs.json: {e}")

    # LOUD FAILURE CONDITION:
    # If more than 50% of requests are blocked with HTTP 403, fail loudly!
    if total_attempted >= 5 and ratio_403 >= 50.0:
        err_msg = f"CRITICAL: Akamai Bot Manager blocked {blocked_403}/{total_attempted} ({ratio_403:.1f}%) requests with HTTP 403!"
        print(f"::error title=Foundit Akamai Block::{err_msg}")
        raise RuntimeError(err_msg)

    return total_saved

if __name__ == "__main__":
    scrape(limit=25)
