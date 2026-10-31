import json,re,datetime,urllib.request,unicodedata,concurrent.futures
from urllib.parse import urljoin,urlparse
from pathlib import Path
from bs4 import BeautifulSoup
URL="https://www.comuniazo.com/comunio-apuestas/jugadores?orden=puntos&posicion=todos&valor=todos"
path=Path("datos-comuniazo-prueba/ultimo.json")
previous=json.loads(path.read_text(encoding="utf-8"))
def norm(s):
 return "".join(c for c in unicodedata.normalize("NFD",str(s).lower()) if unicodedata.category(c)!="Mn").strip()
old={norm(p["jugador"]):p for p in previous["jugadores"]}
BASE="https://www.comuniazo.com"
TEAM_INDEX=BASE+"/laliga"
def slug(s):
 return re.sub(r"(^-|-$)","",re.sub(r"[^a-z0-9]+","-",unicodedata.normalize("NFKD",str(s)).encode("ascii","ignore").decode().lower()))
def fetch_html(url):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ComunioLaviana/1.0)"})
 with urllib.request.urlopen(req,timeout=40) as response:
  if urlparse(response.geturl()).hostname!="www.comuniazo.com":raise RuntimeError("Redirección externa no admitida")
  return BeautifulSoup(response.read(),"html.parser")
def path_of(href):
 url=urlparse(urljoin(BASE,href or ""))
 if url.hostname!="www.comuniazo.com":return ""
 return url.path.rstrip("/")
def club_roster(link):
 url=urljoin(BASE,link)
 soup=fetch_html(url)
 heading=soup.find("h1")
 club=heading.get_text(" ",strip=True) if heading else ""
 if not club:raise RuntimeError("No se encontró el nombre del club: "+url)
 keys=set()
 # Solo los enlaces bajo el título 'Jugadores'. Fuera de esa sección hay
 # noticias sobre fichajes antiguos: sus enlaces NO prueban pertenencia al club.
 roster_title=next((h for h in soup.select("h2") if norm(h.get_text(" ",strip=True))=="jugadores"),None)
 if not roster_title:raise RuntimeError("Falta sección Jugadores de "+club)
 for element in roster_title.next_elements:
  if getattr(element,"name",None)=="h2":break
  if getattr(element,"name",None)!="a":continue
  p=path_of(element.get("href"))
  m=re.fullmatch(r"/comunio-apuestas/jugadores/([a-z0-9-]+)",p)
  if not m:continue
  keys.add("slug:"+m.group(1))
  # El slug puede diferir del nombre: por ejemplo "Pau Cubarsí" -> "/cubarsi".
  # La ficha de club muestra "Pau Cubarsí 5,4 / 98 / 10.300.000".
  text=element.get_text(" ",strip=True)
  name_parts=re.split(r"\s+-?\d+(?:[.,]\d+)?\s*/",text,maxsplit=1)
  if len(name_parts)==2 and len(name_parts[0].strip())>=2:
   keys.add("name:"+norm(name_parts[0]))
 count_players=sum(key.startswith("slug:") for key in keys)
 if count_players<15:raise RuntimeError("Plantilla incompleta de "+club+": "+str(count_players)+" jugadores")
 return club,keys
def teams_from_comuniazo():
 league=fetch_html(TEAM_INDEX)
 links=set()
 for a in league.select("a[href]"):
  p=path_of(a.get("href"))
  if re.fullmatch(r"/comunio-apuestas/equipos/[a-z0-9-]+",p):links.add(p)
 if len(links)!=20:raise RuntimeError("LaLiga no devuelve 20 clubes: "+str(len(links)))
 mapping={}
 clubs=set()
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
  for club,keys in pool.map(club_roster,sorted(links)):
   if club in clubs:raise RuntimeError("Club repetido en Comuniazo: "+club)
   clubs.add(club)
   for key in keys:
    if key in mapping and mapping[key]!=club:
     raise RuntimeError("El jugador "+key+" aparece en dos clubes: "+mapping[key]+" y "+club)
    mapping[key]=club
 player_slugs=sum(key.startswith("slug:") for key in mapping)
 if len(clubs)!=20 or player_slugs<490:
  raise RuntimeError("Las plantillas oficiales no contienen suficientes jugadores: "+str(player_slugs))
 return mapping,len(clubs)
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
 # Quitar procedencia heredada: clubes y posiciones deben identificarse en la descarga.
 record.pop("fuente_equipo_posicion",None)
 record.pop("fuente_equipo",None)
 record.pop("fuente_posicion",None)
 record.update({"jugador":name,"puntos":int(points),"valor_eur":int(value),"fecha":datetime.date.today().isoformat(),"fuente_puntos":"Comuniazo"})
 # Usar el enlace de ficha que muestra Comuniazo; el slug deducido del nombre
 # no siempre coincide (por ejemplo Pau Cubarsí -> cubarsi).
 player_link=td[0].find("a",href=True)
 player_path=path_of(player_link.get("href")) if player_link else ""
 if re.fullmatch(r"/comunio-apuestas/jugadores/[a-z0-9-]+",player_path):
  record["url_ficha"]=BASE+player_path
 else:
  record.pop("url_ficha",None)
 record.setdefault("equipo","")
 record.setdefault("posicion_filtro","")
 records.append(record)
# Obtener los clubes únicamente de las plantillas publicadas por Comuniazo.
# No existe fallback a equipos.json ni a los clubes guardados en descargas previas.
team_map,team_count=teams_from_comuniazo()
assigned=0
unmatched_previously_assigned=[]
for record in records:
 player_name=record["jugador"]
 current=team_map.get("name:"+norm(player_name)) or team_map.get("slug:"+slug(player_name),"")
 previous_team=old.get(norm(player_name),{}).get("equipo","")
 if current:assigned+=1
 elif previous_team:unmatched_previously_assigned.append(player_name)
 record["equipo"]=current
 record["fuente_equipo"]="Comuniazo"
 record["equipo_estado"]="asignado" if current else "sin_club_en_plantillas"
# Una mala coincidencia de nombres no debe borrar decenas de clubes.
if assigned<490 or len(unmatched_previously_assigned)>30:
 raise RuntimeError("Plantillas incompletas o nombres no reconocidos: "+
                    str(assigned)+" clubes identificados de "+str(len(records))+
                    "; pendientes con club previo: "+", ".join(unmatched_previously_assigned[:20]))
print("CLUBES COMUNIAZO:",team_count,"equipos;",assigned,"jugadores asignados;",
      len(records)-assigned,"sin club verificado")
if unmatched_previously_assigned:
 print("NOMBRES A REVISAR:",", ".join(unmatched_previously_assigned[:30]))

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
path.write_text(json.dumps({"fecha":datetime.date.today().isoformat(),"fuente":URL,
 "fuente_equipos":TEAM_INDEX,"equipos_verificados":team_count,
 "jugadores_con_equipo":assigned,"jugadores_sin_equipo":len(records)-assigned,
 "jugadores":records},ensure_ascii=False),encoding="utf-8")
print("Jugadores actualizados:",len(records))
