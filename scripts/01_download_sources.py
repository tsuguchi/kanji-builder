#!/usr/bin/env python3
"""Download upstream Japanese language data sources for Kanji Builder.

Sources & licenses (see project README for full attribution):
  - KANJIDIC2: https://www.edrdg.org/kanjidic/kanjidic2.xml.gz  (CC BY-SA 4.0)
  - JMdict:    https://www.edrdg.org/pub/Nihongo/JMdict_e.gz    (CC BY-SA 4.0)
  - KRADFILE:  https://www.edrdg.org/kradinf/kradzip.zip        (EDRDG License)
  - KanjiVG:   https://github.com/KanjiVG/kanjivg/releases       (CC BY-SA 3.0)
  - Tatoeba:   https://downloads.tatoeba.org/exports/sentences.tar.bz2 (CC BY 2.0 FR)

For MVP step 1, only KANJIDIC2 is downloaded. Other sources will be added
as the pipeline grows.

All files land in data/raw/. Compressed files are auto-extracted.
Re-running is idempotent: existing files are skipped.

Usage:
    python scripts/01_download_sources.py
    python scripts/01_download_sources.py --source kanjidic2
    python scripts/01_download_sources.py --force        # re-download
"""

from __future__ import annotations

import argparse
import gzip
import shutil
import sys
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"

SOURCES: dict[str, dict[str, str]] = {
    "kanjidic2": {
        "url": "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz",
        "compressed": "kanjidic2.xml.gz",
        "extracted": "kanjidic2.xml",
        "license": "CC BY-SA 4.0 (EDRDG)",
    },
}


def human_size(n: int) -> str:
    for unit in ("B", "KiB", "MiB", "GiB"):
        if n < 1024:
            return f"{n:,.0f} {unit}" if unit == "B" else f"{n:,.1f} {unit}"
        n /= 1024  # type: ignore[assignment]
    return f"{n:.1f} TiB"


def download(url: str, dest: Path, force: bool) -> None:
    if dest.exists() and not force:
        print(f"  [skip]   {dest.name} ({human_size(dest.stat().st_size)})")
        return
    print(f"  [fetch]  {url}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "kanji-builder-pipeline/0.1 (+private project)"},
    )
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(req) as r, tmp.open("wb") as f:
        shutil.copyfileobj(r, f)
    tmp.replace(dest)
    print(f"  [ok]     {dest.name} ({human_size(dest.stat().st_size)})")


def gunzip(src: Path, dest: Path, force: bool) -> None:
    if dest.exists() and not force:
        print(f"  [skip]   {dest.name} ({human_size(dest.stat().st_size)})")
        return
    print(f"  [gunzip] {src.name} -> {dest.name}")
    with gzip.open(src, "rb") as fi, dest.open("wb") as fo:
        shutil.copyfileobj(fi, fo)
    print(f"  [ok]     {dest.name} ({human_size(dest.stat().st_size)})")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download Japanese language data sources for the Kanji Builder pipeline."
    )
    parser.add_argument(
        "--source",
        choices=[*SOURCES.keys(), "all"],
        default="all",
        help="Which source to download (default: all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if files already exist",
    )
    args = parser.parse_args()

    names = list(SOURCES.keys()) if args.source == "all" else [args.source]

    for name in names:
        info = SOURCES[name]
        print(f"\n=== {name}  [{info['license']}] ===")
        compressed = RAW_DIR / info["compressed"]
        extracted = RAW_DIR / info["extracted"]
        download(info["url"], compressed, args.force)
        gunzip(compressed, extracted, args.force)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
