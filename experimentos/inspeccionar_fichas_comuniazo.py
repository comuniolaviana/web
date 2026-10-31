import urllib.request,re
from bs4 import BeautifulSoup
for slug in ("raphinha","mbappe"):
 url="https://www.comuniazo.com/comunio-apuestas/jugadores/"+slug
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
  with urllib.request.urlopen(req,timeout=30) as r:html=r.read().decode("utf-8","replace");print("PAGE",slug,r.status,len(html),r.geturl())
  soup=BeautifulSoup(html,"html.parser")
  print("TITLE",soup.title.get_text(" ",strip=True) if soup.title else "")
  for table in soup.find_all("table")[:8]:
   print("TABLE",len(table.find_all("tr")),table.get_text(" ",strip=True)[:900])
  for tag in soup.find_all(["h1","h2","h3","h4"]):print("HEADING",tag.get_text(" ",strip=True)[:100])
  for key in ("Amarillas","Rojas","Jornada","Puntos","Expulsiones","Goles","Asistencias"):
   m=re.search(key,html,re.I)
   if m:print("KEY",key,BeautifulSoup(html[max(0,m.start()-250):m.start()+500],"html.parser").get_text(" ",strip=True)[:450])
 except Exception as e:print("ERROR",slug,str(e))

  for h in soup.find_all(["h2","h3","h4"]):
   if any(t in h.get_text(" ",strip=True) for t in ("Historial de puntos","Puntos","Valor de mercado")):
    print("SECTION",h.get_text(" ",strip=True),str(h.parent)[:9500].replace("\\n"," "))
