python awco_scraper.py | grep -v "^  [A-Z]" | tail -20
python - <<'P'
import csv
rows=list(csv.DictReader(open("awco_listings.csv")))
print("rows",len(rows),"dup urls",len(rows)-len({r['url'] for r in rows}))
for r in rows:
    if int(r["price"])<1000 or "newwatches" in r["url"] or "gifts" in r["url"]:
        print("  ",r["price"],r["brand"],"|",r["title"][:60],"|",r["url"])
P
