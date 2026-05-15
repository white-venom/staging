import urllib.request
import json
import urllib.error

req = urllib.request.Request(
    'http://127.0.0.1:8000/auth/login', 
    data=json.dumps({'phone': '7900671145', 'password': 'password123'}).encode(), 
    headers={'Content-Type': 'application/json'}, 
    method='POST'
)

try:
    print(urllib.request.urlopen(req).read().decode())
except urllib.error.HTTPError as e:
    print(e.read().decode())
