import requests, json, os, sys
url = 'https://unstop.com/api/public/opportunity/search-result'
params = {'opportunity':'jobs','page':1,'size':5}
headers = {'User-Agent':'Mozilla/5.0'}
resp = requests.get(url, params=params, headers=headers)
print('status', resp.status_code)
if resp.status_code == 200:
    data = resp.json()
    records = []
    if 'data' in data:
        inner = data['data']
        if isinstance(inner, dict):
            records = inner.get('data', [])
        elif isinstance(inner, list):
            records = inner
    if not records and 'records' in data:
        records = data['records']
    for i, item in enumerate(records[:3]):
        print('item', i, 'public_url:', item.get('public_url'))
        print('title:', item.get('title'))
else:
    print('failed')
