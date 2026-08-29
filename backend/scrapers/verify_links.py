import concurrent.futures
import requests
from config import get_jobs_collection

def check_link(job):
    url = job.get('job_url') or job.get('link')
    if not url:
        return None
    
    is_internshala = 'internshala.com' in url
    method = 'GET' if is_internshala else 'HEAD'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, allow_redirects=True, timeout=10)
        else:
            response = requests.head(url, headers=headers, allow_redirects=True, timeout=10)
            if response.status_code in [403, 405]:
                response = requests.get(url, headers=headers, allow_redirects=True, timeout=10)
                
        if response.status_code >= 400:
            return job['_id'], 'broken'
            
        if is_internshala and response.status_code == 200:
            lower_text = response.text.lower()
            if 'applications are closed' in lower_text or 'is closed' in lower_text or 'expired' in lower_text:
                return job['_id'], 'broken'
                
        return job['_id'], 'ok'
    except Exception:
        # Default fail-open: if there is a network error in the crawler/checker, treat as ok
        return job['_id'], 'ok'

def verify():
    collection = get_jobs_collection()
    print("Running link verification...")
    # Only verify jobs that are not already marked broken
    jobs = list(collection.find({"is_broken": {"$ne": True}}))
    print(f"Checking links for {len(jobs)} active jobs...")
    
    broken_count = 0
    ok_count = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(check_link, jobs)
        
        for res in results:
            if res:
                job_id, status = res
                if status == 'broken':
                    collection.update_one({"_id": job_id}, {"$set": {"is_broken": True}})
                    broken_count += 1
                else:
                    ok_count += 1
                    
    print(f"Link verification completed. Verified: {ok_count}, Broken: {broken_count}")
    return ok_count + broken_count, broken_count

if __name__ == "__main__":
    verify()
