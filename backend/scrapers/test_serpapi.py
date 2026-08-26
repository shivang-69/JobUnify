import os
import json
import requests
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

api_key = os.getenv("SERPAPI_KEY")
if not api_key:
    print("Error: SERPAPI_KEY not found in .env")
    exit(1)

url = "https://serpapi.com/search"
params = {
    "engine": "google_jobs",
    "q": "software developer fresher jobs",
    "location": "India",
    "gl": "in",
    "api_key": api_key
}

print(f"Making SerpApi call to google_jobs with parameters: {params}")
try:
    resp = requests.get(url, params=params, timeout=20)
    print(f"Response status code: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Response error content: {resp.text}")
        exit(1)
        
    data = resp.json()
    jobs = data.get("jobs_results", [])
    print(f"\nSuccessfully returned {len(jobs)} jobs in this single call.")
    
    # Save the raw JSON to the artifact directory for user review
    artifact_path = "C:/Users/Shivang Sharma/.gemini/antigravity-ide/brain/d6f42628-0501-4683-a70e-976dfeb7f919/serpapi_jobs_raw.json"
    with open(artifact_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved complete raw JSON response to: {artifact_path}")
    
    # Analyze 5 samples
    print("\n==================================================")
    print("ANALYSIS OF 5 SAMPLE GOOGLE JOBS RESULTS")
    print("==================================================")
    
    for idx, j in enumerate(jobs[:5]):
        print(f"\n--- Job {idx+1} ---")
        print(f"Title:        {j.get('title')}")
        print(f"Company:      {j.get('company_name')}")
        print(f"Location:     {j.get('location')}")
        
        # Check source/via
        via = j.get("via")
        print(f"Original Source: {via}")
        
        # Check description
        desc = j.get("description", "")
        print(f"Description Length: {len(desc)} characters")
        print(f"Description Sample (first 300 chars):")
        print(f"  {desc[:300].strip()}...")
        
        # Check qualifications / extensions / structured fields
        extensions = j.get("extensions", [])
        print(f"Extensions (Structured details): {extensions}")
        
        # Google Jobs results usually store job details (salary, benefits, etc.) inside the 'detected_extensions' or 'extensions'
        detected = j.get("detected_extensions", {})
        print(f"Detected Extensions: {detected}")
        print("-" * 50)

except Exception as e:
    print(f"Exception: {e}")
