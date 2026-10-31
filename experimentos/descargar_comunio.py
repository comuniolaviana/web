import csv,datetime,re,time,urllib.request,urllib.parse
from bs4 import BeautifulSoup
from pathlib import Path

BASE="https://stats.comunio.es/search.php"
TODAY=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=1))).date().isoformat()
OUT=Path("datos-comunio-prueba")
OUT.mkdir(exist_ok=True)
records=[]
for position in ("t","a","m","s"):
    seen=set()
    for offset in range(0,1250,25):
        q=urllib.parse.urlencode({"lang":"es","season":"2026","startGd":"1","endGd":"13","pos[]":position,"startLimit":offset})
        url=BASE+"?"+q
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req,timeout=25) as response:
                soup=BeautifulSoup(response.read(),"html.parser")
        except Exception as exc:
            print("ERROR",position,offset,str(exc));break
        tables=[]
        for table in soup.find_all("table"):
            head=table.find("tr")
            if head and "Valor de mercado" in head.get_text(" ",strip=True) and "Puntos" in head.get_text(" ",strip=True) and "Equipo" in head.get_text(" ",strip=True):
                tables.append(table)
        if not tables:
            print("SIN_TABLA",position,offset);break
        rows=tables[-1].find_all("tr",recursive=False)[1:]
        page=[]
        for tr in rows:
            td=tr.find_all("td",recursive=False)
            if len(td)<8:continue
            name=td[1].get_text(" ",strip=True)
            if not name:continue
            value=re.sub(r"[^0-9]","",td[3].get_text(" ",strip=True))
            pts=td[7].get_text(" ",strip=True) if len(td)>=10 else ""\n            team_img=td[2].find("img")\n            team=team_img.get("title","") if team_img else ""\n            player_id=td[1].get("data-playerid","")
            if not value or not re.fullmatch(r"-?\d+",pts):continue
            playerlink=td[1].find("a",href=True)
            pid=playerlink["href"] if playerlink else name
            key=(position,player_id or pid)
            if key in seen:continue
            seen.add(key)
            page.append({"fecha":TODAY,"temporada":"2026/27","posicion_filtro":position,"jugador":name,"id_jugador":player_id,"equipo":team,"id_enlace":pid,"valor_eur":int(value),"puntos":int(pts),"url_origen":url})
        records.extend(page)
        print("PAGINA",position,offset,"filas",len(page))
        if len(rows)<25 or not page:break
        time.sleep(.3)
print("TOTAL",len(records))
if len(records)<500:raise RuntimeError("Menos de 300 filas verificadas; no se publica archivo")
with (OUT/f"comunio_{TODAY}.csv").open("w",newline="",encoding="utf-8-sig") as f:
    writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
print("ARCHIVO",OUT/f"comunio_{TODAY}.csv")
