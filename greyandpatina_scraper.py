#!/usr/bin/env python3
"""
Grey & Patina scraper - uses Browse AI REST API
Robot ID: 019dac75-6cd8-7901-ad6b-70476a8a1875
"""
import os, sys, json, csv, re, requests
from datetime import date

ROBOT_ID = "019dac75-6cd8-7901-ad6b-70476a8a1875"
OUTPUT = "greyandpatina_listings.csv"

def parse_price(raw):
    if not raw:
        return 0
    nums = re.findall(r'[\d]+', raw.replace(",", ""))
    return int(nums[0]) if nums else 0

def fetch_latest(api_key):
    url = f"https://api.browse.ai/v2/robots/{ROBOT_ID}/tasks?page=1"
    r = requests.get(url, headers={"Authorization": f"Api-Key {api_key}"}, timeout=30)
    r.raise_for_status()
    tasks = r.json().get("result", {}).get("robotTasks", {}).get("items", [])
    if not tasks:
        print("No tasks found")
        return []
    task_id = tasks[0]["id"]
    print(f"  Using task: {task_id}")
    r2 = requests.get(f"https://api.browse.ai/v2/robots/{ROBOT_ID}/tasks/{task_id}",
                      headers={"Authorization": f"Api-Key {api_key}"}, timeout=30)
    r2.raise_for_status()
    captured = r2.json().get("result", {}).get("capturedLists", {})
    items = []
    for key, rows in captured.items():
        if isinstance(rows, list):
            items.extend(rows)
    return items

def main():
    api_key = os.environ.get("BROWSE_AI_API_KEY", "")
    if not api_key:
        print("BROWSE_AI_API_KEY not set")
        sys.exit(1)

    use_latest = "--latest" in sys.argv
    print(f"Starting Grey & Patina scraper (Browse AI)...")

    raw_items = fetch_latest(api_key)
    print(f"  Fetched {len(raw_items)} raw items")

    listings = []
    for item in raw_items:
        title = item.get("Product Title", "").strip()
        if not title:
            continue
        price = parse_price(item.get("Price", ""))
        if price < 500:
            continue
        listings.append({
            "title": title,
            "price": price,
            "url": item.get("Product URL", ""),
            "img": item.get("Image URL", ""),
            "sold": False,
            "date": str(date.today()),
            "description": "",
        })

    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["title","price","url","img","sold","date","description"])
        writer.writeheader()
        writer.writerows(listings)

    print(f"  Written {len(listings)} listings to {OUTPUT}")

if __name__ == "__main__":
    main()
