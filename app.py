import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
car_image_cache = {}

@app.route("/")
def index():
    # later you can pass DB data into the template here
    return render_template("index.html")

def fetch_google_image(query):
    cache_key = query.lower().strip()
    cached = car_image_cache.get(cache_key)
    if cached:
        return cached, None

    api_key = "AIzaSyDiN7SxeG7StdE9QUVPjTBQUHc6tDJzUCI" #os.environ.get("GOOGLE_CSE_API_KEY")
    cx = "b565745addb9f4619" #os.environ.get("GOOGLE_CSE_CX")
    if not api_key or not cx:
        return None, "missing_api_key"

    params = urlencode({
        "key": api_key,
        "cx": cx,
        "q": query,
        "searchType": "image",
        "num": 1,
        "safe": "active",
    })
    url = f"https://www.googleapis.com/customsearch/v1?{params}"
    req = Request(url, headers={"User-Agent": "OctaneCalculator/1.0"})
    with urlopen(req, timeout=8) as response:
        payload = json.load(response)

    items = payload.get("items") or []
    if not items:
        return None, "no_results"

    image_url = items[0].get("link")
    if image_url:
        car_image_cache[cache_key] = image_url
    return image_url, None

@app.route("/api/image")
def image_lookup():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify({"error": "missing_query"}), 400

    try:
        image_url, error = fetch_google_image(query)
    except Exception:
        return jsonify({"error": "lookup_failed"}), 502

    if error:
        status = 503 if error == "missing_api_key" else 404
        return jsonify({"error": error}), status

    return jsonify({"image_url": image_url})

if __name__ == "__main__":
    app.run(debug=True)
