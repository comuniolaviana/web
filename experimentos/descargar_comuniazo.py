import json,re,datetime,urllib.request,unicodedata
from pathlib import Path
from bs4 import BeautifulSoup
URL="https://www.comuniazo.com/comunio-apuestas/jugadores?orden=puntos&posicion=todos&valor=todos"
req=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0"})
with urllib.request.urlopen(req,timeout=35) as response:soup=BeautifulSoup(response.read(),"html.parser")
tables=[t for t in soup.find_all("table") if len(t.find_all("tr"))>300]
if not tables:raise RuntimeError("No se encontró tabla de jugadores")
def normalize(s):return "".join(c for c in unicodedata.normalize("NFD",s.lower()) if unicodedata.category(c)!="Mn").strip()
prior=json.loads(Path("datos-comunio-prueba/ultimo.json").read_text(encoding="utf-8"))
lookup={normalize(p["jugador"]):p for p in prior["jugadores"]}
records=[]
for tr in tables[0].find_all("tr")[1:]:
 td=tr.find_all("td",recursive=False)
 if len(td)<9:continue
 name=td[0].get_text(" ",strip=True)
 points=td[1].get_text(" ",strip=True)
 value=re.sub(r"[^0-9]","",td[7].get_text(" ",strip=True))
 if not name or not re.fullmatch(r"-?\\d+",points) or not value:continue
 previous=lookup.get(normalize(name),{})
 records.append({"jugador":name,"puntos":int(points),"valor_eur":int(value),"equipo":previous.get("equipo",""),"posicion_filtro":previous.get("posicion_filtro",""),"id_jugador":previous.get("id_jugador",""),"fecha":datetime.date.today().isoformat(),"fuente_puntos":"Comuniazo","fuente_equipo_posicion":"Comunio Stats (referencia previa)" if previous else "sin verificar"})
print("FILAS",len(records),"MATCH_EQUIPOS",sum(bool(x["equipo"]) for x in records))
print("PRIMEROS",[(r["jugador"],r["puntos"],r["valor_eur"]) for r in records[:10]])
if len(records)<550:raise RuntimeError("Descarga incompleta")
out=Path("datos-comuniazo-prueba");out.mkdir(exist_ok=True)
(out/"ultimo.json").write_text(json.dumps({"fecha":datetime.date.today().isoformat(),"fuente":URL,"jugadores":records,"nota":"Puntos y valor: Comuniazo; equipo y posición: datos previos de Comunio Stats, si disponibles"},ensure_ascii=False),encoding="utf-8")
