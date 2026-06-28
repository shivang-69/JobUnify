import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load .env file from the current directory
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

def get_jobs_collection():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/jobunify")
    # Clean up the placeholder if present
    if "your_mongodb_connection_string" in mongo_uri or "your_connection_string" in mongo_uri:
        mongo_uri = "mongodb://127.0.0.1:27017/jobunify"
    
    client = MongoClient(mongo_uri)
    db = client.get_database() # Defaults to the db name in connection string or 'test'
    # If db is test, override to jobunify database
    if db.name == "test":
        db = client["jobunify"]
        
    return db["jobs"]
