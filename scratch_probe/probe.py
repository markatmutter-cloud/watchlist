import requests, json, collections
H={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","Accept":"application/json"}
def get(url, **p):
    r=requests.get(url,params=p,headers=H,timeout=30)
    return r
for base in ["https://awco.nl","https://amsterdamvintagewatches.com"]:
    print("="*30, base)
    api=base+"/wp-json/wc/store/v1/products"
    for p in [{}, {"stock_status":"instock"}, {"stock_status":"outofstock"}, {"stock_status":"onbackorder"}]:
        r=get(api,per_page=1,**p); print(p, r.status_code, "total=",r.headers.get("x-wp-total"))
    r=get(api+"/categories")
    try:
        cats=r.json()
        for c in cats: print(f"  cat id={c['id']} parent={c.get('parent')} slug={c['slug']} name={c['name']!r} count={c.get('count')}")
    except Exception as e: print("cats err", r.status_code, r.text[:300])
    # first 300 in-stock items: summary
    items=[]
    for page in range(1,4):
        r=get(api,per_page=100,page=page,stock_status="instock")
        j=r.json()
        if not j: break
        items+=j
        if len(j)<100: break
    print("instock sampled:",len(items))
    cc=collections.Counter(); cur=collections.Counter(); zero=0
    for it in items:
        for c in it.get("categories",[]): cc[c["slug"]]+=1
        pr=it.get("prices",{}); cur[(pr.get("currency_code"),pr.get("currency_minor_unit"))]+=1
        if not int(pr.get("price") or 0): zero+=1
    print(" cats:",cc.most_common(40)); print(" currency:",cur, "zero-price:",zero)
    for it in items[:25]:
        pr=it["prices"]
        print("  ",it["name"][:70],"|",pr["price"],pr["currency_code"],"|",it["permalink"],"| instock",it.get("is_in_stock"),"purch",it.get("is_purchasable"),"|",[c["slug"] for c in it["categories"]], "| img",(it["images"][0]["src"] if it["images"] else "")[:90])
    keys=set(items[0].keys()) if items else set(); print(" keys:",sorted(keys))
    if items:
        it=items[0]; print(" attrs:",json.dumps(it.get("attributes"))[:800]); print(" brands:",json.dumps(it.get("brands"))[:300]); print(" tags:",json.dumps(it.get("tags"))[:300])
        print(" add_to_cart:",json.dumps(it.get("add_to_cart"))[:300]); print(" stock_availability:",it.get("stock_availability"))
    # out of stock sample
    r=get(api,per_page=5,stock_status="outofstock")
    for it in (r.json() if r.status_code==200 else []): print("  OOS:",it["name"][:60],it["prices"]["price"],it["permalink"],it.get("stock_availability"))
