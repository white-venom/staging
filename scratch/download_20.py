import os
import urllib.request
import urllib.parse
import time

url = "https://commons.wikimedia.org/wiki/Special:FilePath/India_new_20_INR,_MG_series,_2019,_obverse.jpg"
output_path = r"c:\Users\DELL\Desktop\do-it\do-it-services\frontend\public\images\notes\20.jpg"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0'
}

print(f"Downloading 20 from {url} to {output_path}...")
for attempt in range(5):
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            with open(output_path, 'wb') as out_file:
                out_file.write(response.read())
        print("Successfully downloaded 20!")
        break
    except Exception as e:
        print(f"Attempt {attempt+1} failed: {e}")
        time.sleep(2)
