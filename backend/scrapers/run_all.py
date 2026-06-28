import sys
import os

# Ensure the current directory is in the python path for modules import
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import scrape_internshala
import scrape_unstop
import scrape_naukri
import scrape_indeed
import deduplicator

def main():
    print("========================================")
    print("Starting JobUnify Scraper Orchestrator...")
    print("========================================\n")
    
    results = {
        "Internshala": 0,
        "Unstop": 0,
        "Naukri": 0,
        "Indeed": 0
    }
    
    # 1. Internshala
    try:
        results["Internshala"] = scrape_internshala.scrape()
    except Exception as e:
        print(f"ERROR: Internshala scraper failed: {e}\n")
        
    # 2. Unstop
    try:
        results["Unstop"] = scrape_unstop.scrape()
    except Exception as e:
        print(f"ERROR: Unstop scraper failed: {e}\n")
        
    # 3. Naukri
    try:
        results["Naukri"] = scrape_naukri.scrape()
    except Exception as e:
        print(f"ERROR: Naukri scraper failed: {e}\n")
        
    # 4. Indeed
    try:
        results["Indeed"] = scrape_indeed.scrape()
    except Exception as e:
        print(f"ERROR: Indeed scraper failed: {e}\n")
        
    print("\n========================================")
    print("Running Deduplication Phase...")
    print("========================================\n")
    
    removed = 0
    try:
        removed = deduplicator.deduplicate()
    except Exception as e:
        print(f"ERROR: Deduplication failed: {e}\n")
        
    total_scraped = sum(results.values())
    total_saved = total_scraped - removed
    
    print("\n========================================")
    print("Final Scraping Report Summary:")
    print("========================================")
    print(f"Internshala: {results['Internshala']} jobs")
    print(f"Unstop: {results['Unstop']} jobs")
    print(f"Naukri: {results['Naukri']} jobs")
    print(f"Indeed: {results['Indeed']} jobs")
    print(f"Total Scraped: {total_scraped} jobs")
    print(f"Duplicates Removed: {removed} jobs")
    print(f"Total Unique in Database: {total_saved} jobs")
    print("========================================\n")

if __name__ == "__main__":
    main()
