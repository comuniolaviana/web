#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera equipos.json usando exclusivamente datos obtenidos del backend que alimenta laliga.com.

- NO usa el campo "equipo" de datos.json.
- NO usa el campo "equipo" de equipomalo.json.
- Mantiene EXACTAMENTE los nombres que vienen de Comunio como claves de equipos.json.
- Solo asigna un club cuando el nombre de Comunio coincide de forma segura con el nombre
  descargado de LALIGA (comparación normalizada de mayúsculas, tildes y espacios).
- Si no hay coincidencia segura, deja el equipo en blanco.
- Si LALIGA falla, el script termina con error y NO reemplaza el equipos.json existente.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATOS = ROOT / "datos.json"
EQUIPO_MALO = ROOT / "equipomalo.json"
SALIDA = ROOT / "equipos.json"

LALIGA_HOME = "https://www.laliga.com/laliga-easports/clubes"
API_BASE = "https://apim.laliga.com/public-service"
TEMPORADA = "laliga-easports-2026"

# Fallback conocido; normalmente el script intenta obtener la clave vigente de __NEXT_DATA__.
FALLBACK_KEY = "c13c3a8e2f6b46da9c5c425cf61fab3e"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36"
)


def normalizar(s: str) -> str:
    s = str(s or "").strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.casefold()
    s = re.sub(r"[’'`´]", "", s)
    s = re.sub(r"[-_.]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def request(url: str, key: str | None = None, timeout: int = 30):
    headers = {
        "User-Agent": UA,
        "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
    }
    if key:
        headers["Ocp-Apim-Subscription-Key"] = key
        headers["Accept"] = "application/json"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def buscar_backend_subscription(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "backendSubscription" and isinstance(v, str) and v.strip():
                return v.strip()
            hallado = buscar_backend_subscription(v)
            if hallado:
                return hallado
    elif isinstance(obj, list):
        for v in obj:
            hallado = buscar_backend_subscription(v)
            if hallado:
                return hallado
    return None


def obtener_clave() -> str:
    try:
        html = request(LALIGA_HOME).decode("utf-8", errors="replace")
        m = re.search(
            r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
            html,
            flags=re.S | re.I,
        )
        if m:
            next_data = json.loads(m.group(1))
            clave = buscar_backend_subscription(next_data)
            if clave:
                return clave
    except Exception as e:
        print(f"Aviso: no se pudo leer la clave desde laliga.com: {e}")

    return FALLBACK_KEY


def api_json(path: str, key: str):
    data = request(API_BASE + path, key=key)
    return json.loads(data.decode("utf-8"))


def cargar_nombres_comunio():
    nombres = set()

    if DATOS.exists():
        with DATOS.open(encoding="utf-8-sig") as f:
            d = json.load(f)
        for bloque in ("porteros", "defensas", "medios", "delanteros"):
            for j in d.get(bloque, []):
                nombre = str(j.get("jugador", "")).strip()
                if nombre:
                    nombres.add(nombre)

    if EQUIPO_MALO.exists():
        with EQUIPO_MALO.open(encoding="utf-8-sig") as f:
            d = json.load(f)
        for j in d.get("jugadores", []):
            nombre = str(j.get("jugador", "")).strip()
            if nombre:
                nombres.add(nombre)

    if not nombres:
        raise RuntimeError("No se encontraron jugadores en datos.json ni equipomalo.json")

    return sorted(nombres, key=str.casefold)


def obtener_equipos_primera(key: str):
    standing = api_json(f"/api/v1/subscriptions/{TEMPORADA}/standing", key)
    filas = standing.get("standings") or []
    if len(filas) < 18:
        raise RuntimeError(
            f"LALIGA devolvió una clasificación inesperada ({len(filas)} equipos) "
            f"para {TEMPORADA}."
        )

    equipos = {}
    for fila in filas:
        team = fila.get("team") or {}
        tid = str(team.get("id", "")).strip()
        if not tid:
            continue
        nombre = (
            str(team.get("nickname") or team.get("name") or "").strip()
        )
        if nombre:
            equipos[tid] = nombre

    if len(equipos) < 18:
        raise RuntimeError("No se pudieron identificar suficientes clubes de Primera.")
    return equipos


def descargar_jugadores(key: str, equipos_primera: dict[str, str]):
    """
    El endpoint players/stats devuelve el jugador junto al equipo de esa temporada.
    Usamos la temporada 2026/27 y descartamos cualquier fila cuyo team.id no esté
    entre los clubes actuales de Primera.
    """
    jugadores = []
    for offset in range(0, 1600, 100):
        d = api_json(
            f"/api/v1/subscriptions/{TEMPORADA}/players/stats?limit=100&offset={offset}",
            key,
        )
        lote = d.get("player_stats") or []
        jugadores.extend(lote)
        if len(lote) < 100:
            break

    if not jugadores:
        raise RuntimeError("LALIGA no devolvió jugadores para la temporada actual.")

    oficiales = []
    for p in jugadores:
        team = p.get("team") or {}
        tid = str(team.get("id", "")).strip()
        if tid not in equipos_primera:
            continue

        # El campo 'name' es el nombre mostrado por LALIGA.
        nombre = str(p.get("name") or p.get("nickname") or "").strip()
        if not nombre:
            continue

        oficiales.append(
            {
                "nombre": nombre,
                "equipo": equipos_primera[tid],
                "opta_id": str(p.get("opta_id") or ""),
            }
        )

    if len(oficiales) < 250:
        raise RuntimeError(
            f"Solo se obtuvieron {len(oficiales)} jugadores válidos de Primera; "
            "se cancela para no sobrescribir equipos.json con datos incompletos."
        )
    return oficiales


def construir_mapa(nombres_comunio, jugadores_oficiales):
    """
    Coincidencia conservadora:
      1. normaliza tildes, mayúsculas, guiones y espacios;
      2. solo acepta una coincidencia si esa forma normalizada corresponde a UN único club.
    No hace aproximaciones por apellido ni fuzzy matching para evitar falsos positivos.
    """
    indice = {}
    for p in jugadores_oficiales:
        k = normalizar(p["nombre"])
        if not k:
            continue
        indice.setdefault(k, set()).add(p["equipo"])

    resultado = {}
    encontrados = 0

    for nombre in nombres_comunio:
        clubs = indice.get(normalizar(nombre), set())
        if len(clubs) == 1:
            resultado[nombre] = next(iter(clubs))
            encontrados += 1
        else:
            resultado[nombre] = ""

    return resultado, encontrados


def main():
    nombres = cargar_nombres_comunio()
    key = obtener_clave()

    try:
        equipos_primera = obtener_equipos_primera(key)
        oficiales = descargar_jugadores(key, equipos_primera)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise RuntimeError(
                "LALIGA rechazó la clave de acceso. No se ha tocado equipos.json."
            ) from e
        raise

    mapa, encontrados = construir_mapa(nombres, oficiales)

    salida = {
        "actualizado": datetime.now(ZoneInfo("Europe/Madrid")).strftime("%Y-%m-%d %H:%M:%S"),
        "fuente": "LALIGA EA SPORTS 2026/27 - datos descargados de laliga.com",
        "criterio": "Coincidencia segura con el nombre de Comunio; no encontrados quedan en blanco",
        "equipos": mapa,
    }

    # Escritura atómica: primero temporal, luego sustituye.
    tmp = SALIDA.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(salida, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(SALIDA)

    sin_equipo = len(nombres) - encontrados
    print(f"Clubes LALIGA: {len(equipos_primera)}")
    print(f"Jugadores LALIGA descargados: {len(oficiales)}")
    print(f"Nombres Comunio: {len(nombres)}")
    print(f"Relacionados con seguridad: {encontrados}")
    print(f"Sin coincidencia / en blanco: {sin_equipo}")
    print(f"Generado: {SALIDA}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
