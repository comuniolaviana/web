"""Pruebas sin red de la extracción de plantillas de Comuniazo."""
import ast
import concurrent.futures
import re
import unicodedata
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "experimentos/actualizar_listado_comuniazo.py"
tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
wanted = {"slug", "path_of", "club_roster", "teams_from_comuniazo"}
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in wanted]
assert {f.name for f in functions} == wanted
context = {
    "re": re, "unicodedata": unicodedata,
    "urljoin": urljoin, "urlparse": urlparse,
    "concurrent": concurrent, "BeautifulSoup": BeautifulSoup,
    "BASE": "https://www.comuniazo.com",
    "TEAM_INDEX": "https://www.comuniazo.com/laliga",
    "norm": lambda s: "".join(c for c in unicodedata.normalize("NFD", str(s).lower()) if unicodedata.category(c) != "Mn").strip(),
}
exec(compile(ast.Module(body=functions, type_ignores=[]), str(SOURCE), "exec"), context)

league = "".join(
    f'<a href="/comunio-apuestas/equipos/club-{i}">Club {i}</a>'
    for i in range(1, 21)
)
rosters = {}
for i in range(1, 21):
    links = "".join(
        f'<a href="/comunio-apuestas/jugadores/jugador-{i}-{j}">Jugador {i} {j}</a>'
        for j in range(1, 26)
    )
    rosters[f"/comunio-apuestas/equipos/club-{i}"] = (
        f"<h1>Club {i}</h1><h2>Jugadores</h2>{links}"
        '<h2>Valor de mercado</h2>'
        '<a href="/comunio-apuestas/jugadores/jugador-2-1">Antiguo fichaje</a>'
    )

def fake_fetch(url):
    path = urlparse(url).path
    html = league if path == "/laliga" else rosters[path]
    return BeautifulSoup(html, "html.parser")

context["fetch_html"] = fake_fetch
context["CLUB_PATHS_2627"] = tuple(rosters.keys())
mapping, clubs = context["teams_from_comuniazo"]()
assert clubs == 20 and len(mapping) == 500, (clubs, len(mapping))
assert mapping["slug:jugador-1-1"] == "Club 1"
assert mapping["slug:jugador-20-25"] == "Club 20"
assert context["slug"]("Álex Berenguer") == "alex-berenguer"
assert context["path_of"]("https://www.otraweb.com/comunio-apuestas/jugadores/falso") == ""
print("OK: 20 clubes y 500 jugadores, coincidencias y bloqueo de enlaces externos")

# Si el índice LaLiga no ofrece enlaces, seguir descargando las fichas
# de los 20 clubes sin atribuir jugadores por información antigua.
def missing_index(url):
    if urlparse(url).path == "/laliga":
        return BeautifulSoup("<h1>LaLiga sin enlaces</h1>", "html.parser")
    return fake_fetch(url)
context["fetch_html"] = missing_index
mapping, clubs = context["teams_from_comuniazo"]()
assert clubs == 20 and len(mapping) == 500
print("OK: índice vacío, plantillas actuales verificadas y 20 clubes correctos")
context["fetch_html"] = fake_fetch

# Los nombres de fichero de Comuniazo no siempre coinciden con el nombre.
# El club se debe identificar con el nombre visible en la plantilla.
rosters["/comunio-apuestas/equipos/club-1"] = rosters[
    "/comunio-apuestas/equipos/club-1"
].replace(
    '<a href="/comunio-apuestas/jugadores/jugador-1-1">Jugador 1 1</a>',
    '<a href="/comunio-apuestas/jugadores/cubarsi">Pau Cubarsí 5,4 / 98 / 10.300.000</a>',
)
mapping, clubs = context["teams_from_comuniazo"]()
assert mapping["name:pau cubarsi"] == "Club 1"
assert mapping["slug:cubarsi"] == "Club 1"
print("OK: identifica a Pau Cubarsí aunque el enlace se llame cubarsi")

rosters["/comunio-apuestas/equipos/club-2"] = rosters[
    "/comunio-apuestas/equipos/club-2"
].replace(
    "<h2>Valor de mercado</h2>",
    '<a href="/comunio-apuestas/jugadores/cubarsi">Conflicto</a>'
    "<h2>Valor de mercado</h2>",
)
try:
    context["teams_from_comuniazo"]()
    raise AssertionError("Un jugador en dos clubes debe rechazar la descarga")
except RuntimeError as exc:
    assert "dos clubes" in str(exc)
print("OK: bloquea un jugador duplicado en dos clubes")

def missing_team(url):
    path = urlparse(url).path
    if path == "/laliga":
        return BeautifulSoup(league.replace(
            '<a href="/comunio-apuestas/equipos/club-20">Club 20</a>', ""
        ), "html.parser")
    return fake_fetch(url)

context["fetch_html"] = missing_team
try:
    context["teams_from_comuniazo"]()
    raise AssertionError("Debe rechazar una liga incompleta")
except RuntimeError as exc:
    assert "20 clubes" in str(exc)
print("OK: bloquea una lista incompleta de clubes")
