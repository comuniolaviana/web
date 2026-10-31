import urllib.request
from bs4 import BeautifulSoup
u="https://www.comuniazo.com/comunio-apuestas/jugadores/raphinha"
with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=30) as r:s=BeautifulSoup(r.read(),"html.parser")
for tag in s.find_all(["h1","h2","h3"]):
 print("HEAD",tag.get_text(" ",strip=True),str(tag.parent)[:1200].replace(chr(10)," "))
for div in s.find_all("div",class_=True):
 cl=" ".join(div.get("class",[]))
 if any(k in cl for k in ["match","round","stat","points","journey","calendar","fixture","chart"]):
  print("DIV",cl,div.get_text(" ",strip=True)[:800],str(div)[:1100].replace(chr(10)," "))
