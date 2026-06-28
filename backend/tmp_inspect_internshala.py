import requests, bs4, json, sys
url = 'https://internshala.com/internships/page-1/'
resp = requests.get(url, headers={'User-Agent':'Mozilla/5.0'})
if resp.status_code != 200:
    print('Failed', resp.status_code)
    sys.exit(1)
soup = bs4.BeautifulSoup(resp.text, 'html.parser')
card = soup.select_one('.individual_internship')
if not card:
    print('No card found')
    sys.exit()
print('Card HTML snippet:')
print(card.prettify())
# Find any link within card
link = card.find('a', href=True)
if link:
    print('First href:', link['href'])
else:
    print('No href found')
