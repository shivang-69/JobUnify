import os
import sys
import datetime
import logging
from apscheduler.schedulers.blocking import BlockingScheduler

# Add scrapers path to sys.path
SCRAPERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scrapers')
sys.path.append(SCRAPERS_DIR)

import scrape_internshala
import scrape_unstop
import scrape_naukri
import scrape_indeed
import deduplicator
from config import get_jobs_collection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("scheduler")

def run_scrapers():
    logger.info("Scheduler triggered: Running all 4 scrapers...")
    
    results = {
        "Internshala": 0,
        "Unstop": 0,
        "Naukri": 0,
        "Indeed": 0
    }
    
    # 1. Internshala
    t_start = datetime.datetime.now()
    logger.info(f"Starting Internshala scraper at {t_start}")
    try:
        results["Internshala"] = scrape_internshala.scrape()
        logger.info(f"Completed Internshala scraper at {datetime.datetime.now()}. Saved: {results['Internshala']}")
    except Exception as e:
        logger.error(f"ERROR: Internshala scraper failed: {e}")
        
    # 2. Unstop
    t_start = datetime.datetime.now()
    logger.info(f"Starting Unstop scraper at {t_start}")
    try:
        results["Unstop"] = scrape_unstop.scrape()
        logger.info(f"Completed Unstop scraper at {datetime.datetime.now()}. Saved: {results['Unstop']}")
    except Exception as e:
        logger.error(f"ERROR: Unstop scraper failed: {e}")
        
    # 3. Naukri
    t_start = datetime.datetime.now()
    logger.info(f"Starting Naukri scraper at {t_start}")
    try:
        results["Naukri"] = scrape_naukri.scrape()
        logger.info(f"Completed Naukri scraper at {datetime.datetime.now()}. Saved: {results['Naukri']}")
    except Exception as e:
        logger.error(f"ERROR: Naukri scraper failed: {e}")
        
    # 4. Indeed
    t_start = datetime.datetime.now()
    logger.info(f"Starting Indeed scraper at {t_start}")
    try:
        results["Indeed"] = scrape_indeed.scrape()
        logger.info(f"Completed Indeed scraper at {datetime.datetime.now()}. Saved: {results['Indeed']}")
    except Exception as e:
        logger.error(f"ERROR: Indeed scraper failed: {e}")
        
    logger.info("Running deduplication...")
    try:
        removed = deduplicator.deduplicate()
        logger.info(f"Deduplication complete. Removed {removed} duplicates.")
    except Exception as e:
        logger.error(f"ERROR during deduplication: {e}")

    try:
        col = get_jobs_collection()
        total_jobs = col.count_documents({})
        logger.info(f"Total jobs count in MongoDB after full run: {total_jobs}")
    except Exception as e:
        logger.error(f"ERROR counting jobs: {e}")

def main():
    scheduler = BlockingScheduler()
    logger.info("Scheduling scrapers to run every 6 hours...")
    
    # Run once immediately on start
    run_scrapers()
    
    scheduler.add_job(run_scrapers, 'interval', hours=6)
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")

if __name__ == "__main__":
    main()
