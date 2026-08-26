import os
import json
import requests
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

api_key = os.getenv("RAPIDAPI_KEY")
if not api_key:
    print("Error: RAPIDAPI_KEY not found in .env")
    exit(1)

url = "https://jsearch.p.rapidapi.com/search-v2"
headers = {
    "X-RapidAPI-Key": api_key,
    "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
}

# JSearch query targeting software developer positions in India with LinkedIn focus
params = {
    "query": "software developer in India",
    "job_requirements": "no_experience,under_3_years_experience",
    "page": "1",
    "num_pages": "1"
}

print(f"Making JSearch API call with params: {params}")
try:
    resp = requests.get(url, headers=headers, params=params, timeout=20)
    print(f"Response status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error output: {resp.text}")
        exit(1)
        
    data = resp.json()
    jobs = data.get("data", [])
    print(f"Fetched {len(jobs)} jobs from JSearch.")
    
    # Dump 5 jobs in full detail
    sample_jobs = jobs[:5]
    print("\n==================================================")
    print("5 SAMPLE JOBS FROM JSEARCH")
    print("==================================================")
    for idx, j in enumerate(sample_jobs):
        print(f"\n--- Job {idx+1} ---")
        print(f"Title:        {j.get('job_title')}")
        print(f"Employer:     {j.get('employer_name')}")
        print(f"Publisher:    {j.get('job_publisher')}")
        print(f"Apply Link:   {j.get('job_apply_link')}")
        print(f"Posted At:    {j.get('job_posted_at_datetime_utc')}")
        
        # Experience Info
        req_exp = j.get("job_required_experience", {}) or {}
        print(f"Experience:   no_experience_required={req_exp.get('no_experience_required')}, "
              f"required_experience_in_months={req_exp.get('required_experience_in_months')}")
        
        # Description length and sample
        desc = j.get("job_description", "")
        print(f"Desc Length:  {len(desc)} characters")
        print(f"Desc Sample:  {desc[:400].strip()}...")
        print("-" * 50)
        
    # Also write raw JSON of these 5 jobs to an artifact file for user eyeballing
    out_path = "C:/Users/Shivang Sharma/.gemini/antigravity-ide/brain/d6f42628-0501-4683-a70e-976dfeb7f919/jsearch_sample.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(sample_jobs, f, indent=2, ensure_ascii=False)
    print(f"\nWritten raw JSON output of 5 sample jobs to: {out_path}")

except Exception as e:
    print(f"Exception raised: {e}")
