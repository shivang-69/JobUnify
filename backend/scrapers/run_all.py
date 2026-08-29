import sys
import os

# Ensure the current directory is in the python path for modules import
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import scrape_internshala
# import scrape_unstop  # RETIRED — Unstop disabled. Data preserved in MongoDB.
import scrape_naukri
import scrape_google_jobs
import deduplicator

def main():
    print("========================================")
    print("Starting JobUnify Scraper Orchestrator...")
    print("========================================\n")
    
    results = {
        "Internshala": 0,
        "Naukri": 0,
        "GoogleJobs": 0
    }
    
    # 1. Internshala
    try:
        results["Internshala"] = scrape_internshala.scrape()
    except Exception as e:
        print(f"ERROR: Internshala scraper failed: {e}\n")
        
    # 2. Naukri
    try:
        results["Naukri"] = scrape_naukri.scrape()
    except Exception as e:
        print(f"ERROR: Naukri scraper failed: {e}\n")
        
    # 3. GoogleJobs (SerpApi — replaces Indeed/LinkedIn, quota-throttled to once/day)
    try:
        results["GoogleJobs"] = scrape_google_jobs.scrape()
    except Exception as e:
        print(f"ERROR: GoogleJobs scraper failed: {e}\n")
        
    print("\n========================================")
    print("Running Deduplication Phase...")
    print("========================================\n")
    
    removed = 0
    try:
        removed = deduplicator.deduplicate()
    except Exception as e:
        print(f"ERROR: Deduplication failed: {e}\n")

    print("\n========================================")
    print("Running Link Verification Phase...")
    print("========================================\n")

    verified_count = 0
    broken_count = 0
    try:
        import verify_links
        verified_count, broken_count = verify_links.verify()
    except Exception as e:
        print(f"ERROR: Link verification failed: {e}\n")
        
    total_scraped = sum(results.values())
    total_saved = total_scraped - removed
    
    print("\n========================================")
    print("Final Scraping Report Summary:")
    print("========================================")
    print(f"Internshala: {results['Internshala']} jobs")
    print(f"Naukri: {results['Naukri']} jobs")
    print(f"GoogleJobs: {results['GoogleJobs']} jobs")
    print(f"Total Scraped: {total_scraped} jobs")
    print(f"Duplicates Removed: {removed} jobs")
    print(f"Total Unique in Database: {total_saved} jobs")
    print(f"Verified Links: {verified_count} checked, {broken_count} marked broken")
    print("========================================\n")

if __name__ == "__main__":
    main()
