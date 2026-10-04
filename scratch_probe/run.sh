python3 - <<'P'
import requests,collections
r=requests.get("https://the-watch-list.app/listings_live.json",headers={"User-Agent":"Mozilla/5.0","Cache-Control":"no-cache"},timeout=40)
print(r.status_code, r.headers.get("age"), r.headers.get("x-vercel-cache"))
d=r.json(); items=d if isinstance(d,list) else d.get("listings",[])
c=collections.Counter(i.get("source") for i in items)
print("LIVE total",len(items),"AWCo",c.get("Amsterdam Watch Company",0),"AVW",c.get("Amsterdam Vintage Watches",0))
P
