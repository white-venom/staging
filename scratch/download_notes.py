import os
import urllib.request
import urllib.parse

notes = {
    "500": "India_new_500_INR,_MG_series,_2016,_obverse.jpg",
    "200": "India,_200_INR,_2018,_obverse.jpg",
    "100": "India_new_100_INR,_Mahatma_Gandhi_New_Series,_2018,_obverse.png",
    "50": "India_new_50_INR,_MG_series,_2018,_obverse.jpg",
    "20": "India_new_20_INR,_MG_series,_2019,_obverse.jpg",
    "10": "India_new_10_INR,_MG_series,_2018,_obverse.jpg",
    "1": "One_Rupee_Note.jpg"
}

output_dir = r"c:\Users\DELL\Desktop\do-it\do-it-services\frontend\public\images\notes"
os.makedirs(output_dir, exist_ok=True)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
}

for value, filename in notes.items():
    encoded_filename = urllib.parse.quote(filename)
    url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded_filename}"
    output_path = os.path.join(output_dir, f"{value}.png" if filename.endswith(".png") else f"{value}.jpg")
    print(f"Downloading {value} from {url} to {output_path}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            with open(output_path, 'wb') as out_file:
                out_file.write(response.read())
        print(f"Successfully downloaded {value}!")
    except Exception as e:
        print(f"Failed to download {value}: {e}")
