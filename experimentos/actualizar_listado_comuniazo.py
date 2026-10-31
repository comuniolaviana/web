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
# Clasificar la posición desde los cuatro filtros oficiales de Comuniazo.
# Se valida la cobertura antes de sustituir cualquier posición anterior.
position_map={}
position_ok=True
for codigo,filtro in (("t","porteros"),("a","defensas"),("m","centrocampistas"),("s","delanteros")):
 try:
  url="https://www.comuniazo.com/comunio-apuestas/jugadores?orden=puntos&posicion="+filtro+"&valor=todos"
  request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
  with urllib.request.urlopen(request,timeout=40) as response:
   filtered=BeautifulSoup(response.read(),"html.parser")
  candidates=[table for table in filtered.find_all("table") if len(table.find_all("tr"))>=15]
  if not candidates:raise RuntimeError("Sin tabla "+filtro)
  table=max(candidates,key=lambda table:len(table.find_all("tr")))
  names=set()
  for tr in table.find_all("tr"):
   cells=tr.find_all("td",recursive=False)
   if len(cells)<9:continue
   name=cells[0].get_text(" ",strip=True)
   if not name:continue
   key=norm(name)
   if key in position_map and position_map[key]!=codigo:raise RuntimeError("Posición conflictiva para "+name)
   position_map[key]=codigo
   names.add(key)
  if len(names)<15:raise RuntimeError("Filtro sin jugadores "+filtro)
 except Exception as error:
  print("Posiciones no verificadas:",filtro,str(error))
  position_ok=False
  break
covered=sum(norm(p["jugador"]) in position_map for p in records) if position_ok else 0
if covered>=int(len(records)*0.9):
 for record in records:
  value=position_map.get(norm(record["jugador"]))
  if value:
   record["posicion_filtro"]=value
   record["fuente_posicion"]="Comuniazo"
 print("Posiciones verificadas en Comuniazo:",covered,"/",len(records))
else:
 print("Cobertura de posiciones insuficiente:",covered,"/",len(records),"; se conservan referencias previas")

if len(records)<550:raise RuntimeError("Descarga incompleta; no se modifica archivo")
path.write_text(json.dumps({"fecha":datetime.date.today().isoformat(),"fuente":URL,"jugadores":records},ensure_ascii=False),encoding="utf-8")
print("Jugadores actualizados:",len(records))
