#!/usr/bin/env python3
"""Download upstream Japanese language data sources for Kanji Builder.

Sources & licenses (see project README for full attribution):
  - KANJIDIC2:   https://www.edrdg.org/kanjidic/kanjidic2.xml.gz                       (CC BY-SA 4.0)
  - KRADFILE:    http://ftp.edrdg.org/pub/Nihongo/kradzip.zip                          (EDRDG License)
  - kanji-data:  davidluzgouveia/kanji-data — provides modern N5-N1 mapping            (MIT)
  - JMdict:      https://www.edrdg.org/pub/Nihongo/JMdict_e.gz                         (CC BY-SA 4.0) (TODO)
  - KanjiVG:     https://github.com/KanjiVG/kanjivg/releases                            (CC BY-SA 3.0) (TODO)
  - Tatoeba:     https://downloads.tatoeba.org/exports/sentences.tar.bz2               (CC BY 2.0 FR) (TODO)

All files land in data/raw/. Compressed/zipped sources are auto-extracted.
Re-running is idempotent: existing extracted files are skipped.

Note on encoding:
  KRADFILE/KRADFILE2 are EUC-JP encoded; we do NOT transcode here, the parser
  reads them with the correct encoding directly.

Usage:
    python scripts/01_download_sources.py
    python scripts/01_download_sources.py --source kradfile
    python scripts/01_download_sources.py --force          # re-download
"""

from __future__ import annotations

import argparse
import gzip
import shutil
import sys
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"


@dataclass(frozen=True)
class Source:
    name: str
    url: str
    archive: str                          # local filename under data/raw/
    fmt: Literal["gzip", "zip", "plain"]  # how to handle after download
    members: list[str]                    # gzip/plain: [output filename]; zip: [member1, ...]
    license: str


SOURCES: list[Source] = [
    Source(
        name="kanjidic2",
        url="https://www.edrdg.org/kanjidic/kanjidic2.xml.gz",
        archive="kanjidic2.xml.gz",
        fmt="gzip",
        members=["kanjidic2.xml"],
        license="CC BY-SA 4.0 (EDRDG)",
    ),
    Source(
        name="kradfile",
        url="http://ftp.edrdg.org/pub/Nihongo/kradzip.zip",
        archive="kradzip.zip",
        fmt="zip",
        members=["kradfile", "kradfile2"],
        license="EDRDG License",
    ),
    Source(
        name="kanji-data",
        url="https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json",
        archive="kanji-data.json",
        fmt="plain",
        members=["kanji-data.json"],
        license="MIT (davidluzgouveia/kanji-data) — provides JLPT N5-N1 mapping",
    ),
]


def human_size(n: float) -> str:
    for unit in ("B", "KiB", "MiB", "GiB"):
        if n < 1024:
            return f"{n:,.0f} {unit}" if unit == "B" else f"{n:,.1f} {unit}"
        n /= 1024
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


def extract_gzip(archive: Path, out_name: str, dest_dir: Path, force: bool) -> None:
    dest = dest_dir / out_name
    if dest.exists() and not force:
        print(f"  [skip]   {dest.name} ({human_size(dest.stat().st_size)})")
        return
    print(f"  [gunzip] {archive.name} -> {dest.name}")
    with gzip.open(archive, "rb") as fi, dest.open("wb") as fo:
        shutil.copyfileobj(fi, fo)
    print(f"  [ok]     {dest.name} ({human_size(dest.stat().st_size)})")


def extract_zip(archive: Path, members: list[str], dest_dir: Path, force: bool) -> None:
    with zipfile.ZipFile(archive) as z:
        # Build a lookup of member basename -> ZipInfo (tolerates nested paths).
        by_basename: dict[str, zipfile.ZipInfo] = {}
        for info in z.infolist():
            if info.is_dir():
                continue
            by_basename[Path(info.filename).name] = info

        for want in members:
            dest = dest_dir / want
            if dest.exists() and not force:
                print(f"  [skip]   {dest.name} ({human_size(dest.stat().st_size)})")
                continue
            info = by_basename.get(want)
            if info is None:
                available = ", ".join(sorted(by_basename)) or "(empty)"
                raise SystemExit(
                    f"ERROR: member '{want}' not found in {archive.name}. "
                    f"Available: {available}"
                )
            print(f"  [unzip]  {archive.name}!{info.filename} -> {dest.name}")
            with z.open(info) as fi, dest.open("wb") as fo:
                shutil.copyfileobj(fi, fo)
            print(f"  [ok]     {dest.name} ({human_size(dest.stat().st_size)})")


def fetch(source: Source, force: bool) -> None:
    print(f"\n=== {source.name}  [{source.license}] ===")
    archive = RAW_DIR / source.archive
    download(source.url, archive, force)
    if source.fmt == "gzip":
        # gzip: single member is the output filename.
        extract_gzip(archive, source.members[0], RAW_DIR, force)
    elif source.fmt == "zip":
        extract_zip(archive, source.members, RAW_DIR, force)
    elif source.fmt == "plain":
        # plain: no extraction, the downloaded file IS the data file.
        # If archive name differs from member name, ensure the member is present.
        for want in source.members:
            if want != source.archive:
                dest = RAW_DIR / want
                if not dest.exists() or force:
                    shutil.copyfile(archive, dest)
                    print(f"  [copy]   {archive.name} -> {dest.name}")
    else:
        raise SystemExit(f"Unknown format: {source.fmt}")


def main() -> int:
    names = [s.name for s in SOURCES]
    parser = argparse.ArgumentParser(
        description="Download Japanese language data sources for the Kanji Builder pipeline."
    )
    parser.add_argument(
        "--source",
        choices=[*names, "all"],
        default="all",
        help="Which source to download (default: all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if files already exist",
    )
    args = parser.parse_args()

    targets = SOURCES if args.source == "all" else [s for s in SOURCES if s.name == args.source]
    for s in targets:
        fetch(s, args.force)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
