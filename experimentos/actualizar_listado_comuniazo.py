import json,re,datetime,urllib.request,unicodedata
from pathlib import Path
from bs4 import BeautifulSoup
URL="https://www.comuniazo.com/comunio-apuestas/jugadores?orden=puntos&posicion=todos&valor=todos"
path=Path("datos-comuniazo-prueba/ultimo.json")
previous=json.loads(path.read_text(encoding="utf-8"))
def norm(s):
 return "".join(c for c in unicodedata.normalize("NFD",str(s).lower()) if unicodedata.category(c)!="Mn").strip()
old={norm(p["jugador"]):p for p in previous["jugadores"]}
req=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0"})
with urllib.request.urlopen(req,timeout=40) as response:soup=BeautifulSoup(response.read(),"html.parser")
tables=[t for t in soup.find_all("table") if len(t.find_all("tr"))>300]
if not tables:raise RuntimeError("No se encontró tabla de jugadores; no se modifica archivo")
records=[]
for tr in tables[0].find_all("tr")[1:]:
 td=tr.find_all("td",recursive=False)
 if len(td)<9:continue
 name=td[0].get_text(" ",strip=True)
 points=td[1].get_text(" ",strip=True)
 value=re.sub(r"[^0-9]","",td[7].get_text(" ",strip=True))
 if not name or not re.fullmatch(r"-?\d+",points) or not value:continue
 record=dict(old.get(norm(name),{}))
 record.update({"jugador":name,"puntos":int(points),"valor_eur":int(value),"fecha":datetime.date.today().isoformat(),"fuente_puntos":"Comuniazo"})
 record.setdefault("equipo","")
 record.setdefault("posicion_filtro","")
 records.append(record)
if len(records)<550:raise RuntimeError("Descarga incompleta; no se modifica archivo")
path.write_text(json.dumps({"fecha":datetime.date.today().isoformat(),"fuente":URL,"jugadores":records},ensure_ascii=False),encoding="utf-8")
print("Jugadores actualizados:",len(records))
