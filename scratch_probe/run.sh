set -x
python awco_scraper.py | tail -40
python amsterdamvintagewatches_scraper.py | tail -40
head -c 1500 awco_listings.csv; echo
head -c 1500 amsterdamvintagewatches_listings.csv; echo
python - <<'P'
import csv,requests,urllib.parse
for f in ["awco_listings.csv","amsterdamvintagewatches_listings.csv"]:
    rows=list(csv.DictReader(open(f)))
    img=next(r["img"] for r in rows if r["img"])
    for u in [img, "https://wsrv.nl/?url="+urllib.parse.quote(img,safe="")+"&w=720&output=webp"]:
        r=requests.get(u,headers={"User-Agent":"Mozilla/5.0","Referer":"https://the-watch-list.app/"},timeout=40)
        print(f, r.status_code, r.headers.get("content-type"), len(r.content), u[:110])
    print(f, "dup urls:", len(rows)-len({r['url'] for r in rows}))
P
