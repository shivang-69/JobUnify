import os
from scrapers.config import get_jobs_collection

collection = get_jobs_collection()
res1 = collection.delete_many({'source': 'Internshala'})
res2 = collection.delete_many({'source': 'Unstop'})
print('Deleted Internshala:', res1.deleted_count, 'Deleted Unstop:', res2.deleted_count)
