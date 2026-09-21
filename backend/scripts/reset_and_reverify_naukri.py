import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'scrapers'))

from config import get_jobs_collection
import verify_links

def main():
    col = get_jobs_collection()
    
    # 1. Check current count of broken Naukri jobs
    broken_before = col.count_documents({"source": "Naukri", "is_broken": True})
    total_naukri = col.count_documents({"source": "Naukri"})
    print(f"--- BEFORE ---")
    print(f"Total Naukri documents: {total_naukri}")
    print(f"Naukri documents marked is_broken=True: {broken_before}")
    
    # 2. Reset is_broken on all Naukri jobs
    res = col.update_many(
        {"source": "Naukri", "is_broken": True},
        {"$unset": {"is_broken": ""}}
    )
    print(f"Reset is_broken on {res.modified_count} Naukri documents.")
    
    # 3. Run verify_links.verify() using the updated check_link logic
    print("\nRunning updated link verification...")
    total_checked, broken_count = verify_links.verify()
    
    # 4. Check count of broken Naukri jobs after
    broken_after = col.count_documents({"source": "Naukri", "is_broken": True})
    print(f"\n--- AFTER ---")
    print(f"Total Naukri documents: {total_naukri}")
    print(f"Naukri documents marked is_broken=True: {broken_after}")
    print(f"Broken count dropped from {broken_before} to {broken_after}!")

if __name__ == "__main__":
    main()
