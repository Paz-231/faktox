#!/usr/bin/env python3
"""
Faktox Invoice Agent — gemeinsame Basis für alle Scripts.

Datenverzeichnis:
    Alle Datenbanken (JSON) und abgelegten Dateien liegen im Faktox-Datenverzeichnis.
    Standard:  ~/.faktox
    Override:  Umgebungsvariable FAKTOX_DATA_DIR

Dieses Modul stellt außerdem bereit:
    - file_lock():          portables File-Locking (Windows/macOS/Linux) für
                            atomare Nummernvergabe und sichere parallele Zugriffe
    - write_json_atomic():  atomares Schreiben (temp file + os.replace) — eine
                            halb geschriebene Datenbank ist damit ausgeschlossen
    - SCRIPTS_DIR:          Verzeichnis der Scripts (für Script-zu-Script-Aufrufe)
"""
import json
import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent


def data_dir() -> Path:
    """Faktox-Datenverzeichnis (wird bei Bedarf angelegt)."""
    env = os.environ.get("FAKTOX_DATA_DIR", "").strip()
    d = Path(env).expanduser() if env else Path.home() / ".faktox"
    d.mkdir(parents=True, exist_ok=True)
    return d


DATA_DIR = data_dir()

# Ablage für Original-Dateien (PDFs, Fotos) — incoming_files/{YYYY}/{MM}/
FILES_DIR = DATA_DIR / "incoming_files"


@contextmanager
def file_lock(path, timeout: float = 10.0):
    """Portables Locking über eine .lock-Datei (O_CREAT|O_EXCL ist auf allen
    Plattformen atomar). Verwaiste Locks (> 60 s) werden aufgeräumt."""
    lock = Path(str(path) + ".lock")
    lock.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + timeout
    fd = None
    while fd is None:
        try:
            fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            try:
                if time.time() - lock.stat().st_mtime > 60:
                    lock.unlink()
                    continue
            except OSError:
                pass
            if time.monotonic() > deadline:
                raise TimeoutError(
                    f"Datenbank gesperrt (Lock: {lock}). Läuft ein anderer Faktox-Prozess?"
                )
            time.sleep(0.05)
    try:
        os.close(fd)
        yield
    finally:
        try:
            lock.unlink()
        except OSError:
            pass


def read_json(path, default):
    p = Path(path)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return default


def write_json_atomic(path, data):
    """Atomar schreiben: erst in Temp-Datei, dann os.replace()."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(p.parent), prefix=f".{p.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, str(p))
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def api_key() -> str:
    """OpenRouter-API-Key für KI-Funktionen (Vision-Scan, Text-Parsing).
    OPENROUTER_API_KEY wird bevorzugt; BUILT_IN_FORGE_API_KEY bleibt als
    Fallback für bestehende Setups erhalten."""
    return (
        os.environ.get("OPENROUTER_API_KEY", "")
        or os.environ.get("BUILT_IN_FORGE_API_KEY", "")
    )


def api_url() -> str:
    return (
        os.environ.get("OPENROUTER_API_URL", "")
        or os.environ.get("BUILT_IN_FORGE_API_URL", "")
        or "https://openrouter.ai/api"
    )
