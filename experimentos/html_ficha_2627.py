import urllib.request
from bs4 import BeautifulSoup
u="https://www.comuniazo.com/comunio-apuestas/jugadores/raphinha"
with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=30) as r:s=BeautifulSoup(r.read(),"html.parser")
for cls in ("box-points","box-player","player-stats","box-stats"):
 for d in s.select("."+cls):
  print("HTML",cls,str(d)[:19000])
for h in s.find_all(["h1","h2"]):
 if h.get_text(" ",strip=True)=="Raphinha":print("PROFILE",str(h.parent.parent)[:14000])
