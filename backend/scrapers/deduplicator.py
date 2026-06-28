from config import get_jobs_collection

def deduplicate():
    collection = get_jobs_collection()
    
    print("Running deduplication...")
    all_jobs = list(collection.find())
    print(f"Total jobs in collection before deduplication: {len(all_jobs)}")
    
    seen = {}
    duplicates_to_delete = []
    
    for job in all_jobs:
        title_key = (job.get("title") or "").strip().lower()
        company_key = (job.get("company") or "").strip().lower()
        key = f"{title_key} @ {company_key}"
        
        if key in seen:
            duplicates_to_delete.append(job["_id"])
        else:
            seen[key] = job["_id"]
            
    removed_count = 0
    if duplicates_to_delete:
        result = collection.delete_many({"_id": {"$in": duplicates_to_delete}})
        removed_count = result.deleted_count
        
    print(f"Deduplication completed. Removed {removed_count} duplicate jobs.")
    return removed_count

if __name__ == "__main__":
    deduplicate()
