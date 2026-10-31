import json,re,urllib.request,concurrent.futures,datetime,time
from pathlib import Path
from bs4 import BeautifulSoup
BASE="https://www.comuniazo.com"
source=json.loads(Path("datos-comuniazo-prueba/ultimo.json").read_text(encoding="utf-8"))
def parse(player):
 name=player["jugador"]
 slug=re.sub(r"^-|-$","",re.sub(r"[^a-z0-9]+","-",__import__("unicodedata").normalize("NFKD",name).encode("ascii","ignore").decode().lower()))
 url=BASE+"/comunio-apuestas/jugadores/"+slug
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ComunioLaviana/1.0)"}),timeout=25) as r:
   if "/jugadores/" not in r.geturl():raise ValueError("Redirección inesperada")
   soup=BeautifulSoup(r.read(),"html.parser")
  heading=soup.find("h1")
  if not heading or heading.get_text(" ",strip=True).casefold()!=name.casefold():raise ValueError("Ficha no coincide: "+(heading.get_text(" ",strip=True) if heading else "sin título"))
  weeks=[]
  for el in soup.select(".box-points .points-list .gameweek"):
   num=el.select_one(".number")
   if not num:continue
   match=re.search(r"J\s*(\d+)",num.get_text(" ",strip=True))
   if not match:continue
   bar=el.select_one(".bar span")
   raw=bar.get_text(" ",strip=True) if bar else None
   status=el.select_one(".status")
   events=[]
   for svg in el.select(".events use"):
    href=svg.get("href") or svg.get("xlink:href") or ""
    if "#event-" in href:events.append(href.split("#event-",1)[1])
   weeks.append({"jornada":int(match.group(1)),"puntos":int(raw) if raw and re.fullmatch(r"-?\d+",raw) else None,"estado":status.get_text(" ",strip=True) if status else None,"eventos":events,"partido":el.get("href","")})
  weeks.sort(key=lambda w:w["jornada"])
  if not weeks:raise ValueError("Sin jornadas")
  stats={}
  for box in soup.select(".box"):
   cls=" ".join(box.get("class",[]))
   if any(z in cls for z in ("box-history","box-points","box-chart")):continue
   text=box.get_text(" ",strip=True)
   if text and len(text)<1100:stats[cls]=text
  return {"jugador":name,"url":url,"jornadas":weeks,"estadisticas_visibles":stats,"error":None}
 except Exception as e:return {"jugador":name,"url":url,"jornadas":[],"estadisticas_visibles":{},"error":str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:result=list(pool.map(parse,source["jugadores"]))
ok=sum(bool(x["jornadas"]) for x in result)
print("FICHAS",len(result),"CON_JORNADAS",ok,"ERRORES",len(result)-ok)
print("EJEMPLO",next((x for x in result if x["jugador"]=="Raphinha"),None))
if ok<400:raise RuntimeError("Extracción insuficiente, no publicar")
out=Path("datos-comuniazo-prueba/fichas-2627.json")
out.write_text(json.dumps({"fecha":datetime.datetime.now(datetime.timezone.utc).isoformat(),"temporada":"2026/27","fichas":result},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
