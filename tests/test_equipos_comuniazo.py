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
    rosters[f"/comunio-apuestas/equipos/club-{i}"] = f"<h1>Club {i}</h1><h2>Jugadores</h2>{links}"

def fake_fetch(url):
    path = urlparse(url).path
    html = league if path == "/laliga" else rosters[path]
    return BeautifulSoup(html, "html.parser")

context["fetch_html"] = fake_fetch
mapping, clubs = context["teams_from_comuniazo"]()
assert clubs == 20 and len(mapping) == 500, (clubs, len(mapping))
assert mapping["jugador-1-1"] == "Club 1"
assert mapping["jugador-20-25"] == "Club 20"
assert context["slug"]("Álex Berenguer") == "alex-berenguer"
assert context["path_of"]("https://www.otraweb.com/comunio-apuestas/jugadores/falso") == ""
print("OK: 20 clubes y 500 jugadores, coincidencias y bloqueo de enlaces externos")

rosters["/comunio-apuestas/equipos/club-2"] += (
    '<a href="/comunio-apuestas/jugadores/jugador-1-1">Conflicto</a>'
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
