import sys
sys.path.append('scrapers')
from config import get_jobs_collection

def delete_unstop():
    col = get_jobs_collection()
    result = col.delete_many({"source": "Unstop"})
    print(f"Deleted {result.deleted_count} Unstop documents")

if __name__ == "__main__":
    delete_unstop()
