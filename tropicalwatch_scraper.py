#!/usr/bin/env python3
"""
Tropical Watch scraper - uses Browse AI REST API
Run: python3 tropicalwatch_scraper.py
Requires: pip install requests
Needs: BROWSE_AI_API_KEY environment variable
Output: tropicalwatch_listings.csv

Setup:
  1. Get your API key: https://www.browse.ai/account/api-keys
  2. export BROWSE_AI_API_KEY=your_key_here
  3. python3 tropicalwatch_scraper.py

Flags:
  --latest   Use most recent successful run instead of triggering a new one
"""

import requests, csv, os, time, re, sys
from datetime import date

ROBOT_ID = "019da60c-551b-77d6-b9b3-7c4444586624"
BASE_URL = "https://api.browse.ai/v2"
POLL_INTERVAL = 10
MAX_WAIT = 600

BRANDS = [
    'Rolex','Omega','Patek Philippe','Tudor','Breitling','IWC','Cartier',
    'Jaeger-LeCoultre','Panerai','Audemars Piguet','Vacheron Constantin',
    'A. Lange','Heuer','Zenith','Longines','Universal Geneve',
    'Movado','Aquastar','Czapek','Urwerk','Breguet','Seiko','Blancpain'
]

def detect_brand(name):
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
    return 'Other'

def get_api_key():
    key = os.environ.get('BROWSE_AI_API_KEY', '')
    if not key:
        print("ERROR: Set BROWSE_AI_API_KEY environment variable.")
        print("Get your key: https://www.browse.ai/account/api-keys")
        print("Then: export BROWSE_AI_API_KEY=your_key_here")
        sys.exit(1)
    return key

def trigger_robot(api_key):
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "inputParameters": {
            "originUrl": "https://tropicalwatch.com/watches",
            # Tropical Watch carries ~100-130 listings at any time. 150 gives
            # comfortable headroom without wasting Browse AI rows. If you
            # change this, keep it >= actual inventory so listings don't
            # incorrectly drop out of the scrape and get marked inactive.
            "watches_limit": 150
        }
    }
    print("Triggering Browse AI robot...")
    r = requests.post(
        f"{BASE_URL}/robots/{ROBOT_ID}/tasks",
        headers=headers, json=payload, timeout=30
    )
    r.raise_for_status()
    task_id = r.json()['result']['id']
    print(f"Task started: {task_id}")
    return task_id

def poll_task(api_key, task_id):
    headers = {"Authorization": f"Bearer {api_key}"}
    elapsed = 0
    print(f"Waiting for completion (checking every {POLL_INTERVAL}s)...")
    while elapsed < MAX_WAIT:
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
        r = requests.get(
            f"{BASE_URL}/robots/{ROBOT_ID}/tasks/{task_id}",
            headers=headers, timeout=30
        )
        r.raise_for_status()
        task = r.json()['result']
        status = task.get('status', 'in-progress')
        print(f"  [{elapsed}s] {status}")
        if status == 'successful':
            return task
        elif status == 'failed':
            print(f"Failed: {task.get('userFriendlyError','Unknown error')}")
            return None
    print("Timed out.")
    return None

def get_latest_task(api_key):
    headers = {"Authorization": f"Bearer {api_key}"}
    r = requests.get(
        f"{BASE_URL}/robots/{ROBOT_ID}/tasks",
        headers=headers,
        params={"status": "successful", "pageSize": 1, "sort": "-createdAt"},
        timeout=30
    )
    r.raise_for_status()
    items = r.json()['result']['robotTasks']['items']
    if items:
        print(f"Using latest task: {items[0]['id']}")
        return items[0]
    return None

def parse_results(task):
    captured_lists = task.get('capturedLists', {})
    watches_data = None
    for key, data in captured_lists.items():
        if isinstance(data, list) and len(data) > 0:
            print(f"Found list '{key}' with {len(data)} items")
            watches_data = (key, data)
            break

    if not watches_data:
        print("No list data found. Available keys:", list(captured_lists.keys()))
        return []

    key, items = watches_data
    results = []
    for item in items:
        title = (item.get('Watch Name') or item.get('name') or
                 item.get('title') or item.get('watch_name') or '')
        price_raw = (item.get('Price') or item.get('price') or '')
        url = (item.get('Watch URL') or item.get('url') or item.get('link') or '')
        img = (item.get('Image URL') or item.get('image') or item.get('img') or '')

        if not title:
            continue

        price = 0
        try:
            price = int(float(str(price_raw).replace('$','').replace(',','').strip()))
        except:
            m = re.search(r'[\d,]+', str(price_raw))
            if m:
                try: price = int(m.group(0).replace(',',''))
                except: pass
        if price == 0:
            continue

        results.append({
            'title': title, 'brand': detect_brand(title),
            'price': price, 'url': url, 'img': img,
            'description': '', 'source': 'Tropical Watch',
            'date': str(date.today()), 'sold': False,
        })

    # Sold-state sweep. The Browse AI robot's output schema covers
    # title / price / url / image but not sold-status. Tropical Watch
    # marks sold listings with `<h3 class="watch-main-price color-red"
    # ...>Sold</h3>` on the detail page; without this follow-up
    # fetch, sold listings come through as active because Browse AI
    # captured the historical price elsewhere on the page.
    #
    # Per-listing GET, polite 0.25s delay → ~30s for ~120 listings.
    # Plain requests + Safari UA passes the dealer's response without
    # a Cloudflare challenge (verified 2026-04-29). If that ever
    # changes, fall back to capturing a Status field in the Browse AI
    # robot config and reading it from the item dict above.
    sold_marker = re.compile(
        r'class="watch-main-price[^"]*color-red[^"]*"[^>]*>\s*Sold',
        re.IGNORECASE,
    )
    sold_headers = {
        "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                       "Version/17.0 Safari/605.1.15"),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    print(f"  Sold-state sweep over {len(results)} listing(s)...")
    sold_count = 0
    for i, row in enumerate(results, 1):
        if not row.get('url'):
            continue
        try:
            resp = requests.get(row['url'], headers=sold_headers, timeout=15)
            if resp.status_code == 200 and sold_marker.search(resp.text):
                row['sold'] = True
                sold_count += 1
        except requests.RequestException:
            # Don't fail the scrape on a single transient error —
            # leave sold as default (False) and let the merge layer's
            # disappeared-from-scrape archive logic catch it next run
            # if needed.
            pass
        time.sleep(0.25)
    print(f"  Sold-state sweep done: {sold_count} sold / {len(results)} total")

    return results

def main():
    api_key = get_api_key()

    if '--latest' in sys.argv:
        task = get_latest_task(api_key)
    else:
        task_id = trigger_robot(api_key)
        task = poll_task(api_key, task_id)

    if not task:
        print("No task data.")
        return

    print("\nParsing results...")
    results = parse_results(task)

    if not results:
        print("No listings parsed. Printing raw sample to help debug:")
        for key, val in task.get('capturedLists', {}).items():
            if isinstance(val, list) and val:
                print(f"\nKey '{key}', first item:", val[0])
        return

    output = 'tropicalwatch_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'title','brand','price','url','img','description','source','date','sold'
        ])
        writer.writeheader()
        writer.writerows(results)

    prices = [r['price'] for r in results]
    print(f"\n✓ {len(results)} listings saved to {output}")
    print(f"  Min: ${min(prices):,} | Max: ${max(prices):,} | Avg: ${sum(prices)//len(prices):,}")
    from collections import Counter
    for b, c in Counter(r['brand'] for r in results).most_common(5):
        print(f"  {b}: {c}")

if __name__ == "__main__":
    main()
