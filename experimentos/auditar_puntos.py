import urllib.request,urllib.parse,re
from bs4 import BeautifulSoup
players={"1400":"Courtois","3214":"Joan García","2444":"Sivera","2669":"Unai Simón","3469":"Mbappé"}
positions={"t":["1400","3214","2444","2669"],"s":["3469"]}
for end in (8,9,10,11,12,13,14):
 for pos,ids in positions.items():
  found={}
  for offset in range(0,250,25):
   q=urllib.parse.urlencode({"lang":"es","season":"2026","startGd":"1","endGd":str(end),"pos[]":pos,"startLimit":offset})
   req=urllib.request.Request("https://stats.comunio.es/search.php?"+q,headers={"User-Agent":"Mozilla/5.0"})
   try:
    with urllib.request.urlopen(req,timeout=20) as r:soup=BeautifulSoup(r.read(),"html.parser")
   except Exception as e:print("ERROR",end,pos,e);break
   tables=[t for t in soup.find_all("table") if (t.find("tr") and "Valor de mercado" in t.find("tr").get_text(" ",strip=True) and "Puntos" in t.find("tr").get_text(" ",strip=True))]
   table=tables[-1] if tables else None
   if not table:break
   rows=table.find_all("tr",recursive=False)[1:]
   for tr in rows:
    td=tr.find_all("td",recursive=False)
    if len(td)>7 and td[1].get("data-playerid","") in ids:found[td[1].get("data-playerid")]=td[7].get_text(" ",strip=True)
   if len(found)==len(ids) or len(rows)<25:break
  print("RANGO",end,pos,[(players[k],found.get(k,"NO")) for k in ids],flush=True)
