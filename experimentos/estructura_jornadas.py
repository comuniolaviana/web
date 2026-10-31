import urllib.request
from bs4 import BeautifulSoup
url="https://www.comuniazo.com/comunio-apuestas/jugadores/raphinha"
with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=30) as r:
 soup=BeautifulSoup(r.read(),"html.parser")
for h in soup.find_all(["h2","h3","h4"]):
 if "Historial de puntos" in h.get_text(" ",strip=True):
  print("HISTORY_PARENT",str(h.parent)[:13000])
for s in soup.find_all("script"):
 if s.string and any(t in s.string for t in ["jornadas","puntos","chart","series"]):
  print("SCRIPT",str(s)[:4500])
