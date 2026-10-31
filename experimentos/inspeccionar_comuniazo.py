import urllib.request
from bs4 import BeautifulSoup
url="https://www.comuniazo.com/comunio-apuestas/jugadores?orden=puntos&posicion=todos&valor=todos"
req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ComunioLavianaTest/1.0)"})
with urllib.request.urlopen(req,timeout=30) as response:
 html=response.read().decode("utf-8","replace")
 print("STATUS",response.status,"BYTES",len(html))
soup=BeautifulSoup(html,"html.parser")
for table in soup.find_all("table")[:4]:
 print("TABLA",table.get("class"),"FILAS",len(table.find_all("tr")))
 for tr in table.find_all("tr")[:3]:print("ROW",str(tr)[:1800])
for a in soup.find_all("a",href=True):
 if "Raphinha" in a.get_text(" ",strip=True):print("RAPHINHA",str(a.parent.parent)[:2500]);break
print("PAGINACION",[(a.get_text(" ",strip=True),a.get("href")) for a in soup.find_all("a",href=True) if any(s in a.get_text(" ",strip=True).lower() for s in ["siguiente","next","2","última"])][:15])
