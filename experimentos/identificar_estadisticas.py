import urllib.request
from bs4 import BeautifulSoup
u="https://www.comuniazo.com/comunio-apuestas/jugadores/raphinha"
with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=30) as r:s=BeautifulSoup(r.read(),"html.parser")
for box in s.find_all(["section","div","ul"]):
 cls=" ".join(box.get("class",[]))
 if any(k in cls for k in ("player-stats","box-stats","box-points","box-history","box-info","box-chart","player-info")):
  print("BOX",cls,box.get_text(" ",strip=True)[:1100])
for tag in s.find_all(["canvas","svg"]):
 print("CHART",tag.name,tag.attrs)
for script in s.find_all("script",src=True):
 print("SCRIPT_SRC",script["src"])
for el in s.find_all(attrs={"data-points":True}):print("POINTS_ATTR",str(el)[:500])
