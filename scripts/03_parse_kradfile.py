#!/usr/bin/env python3
"""Parse kradfile + kradfile2 and add radical decomposition tables to kanji.sqlite.

Input:  data/raw/kradfile, data/raw/kradfile2  (both EUC-JP encoded)
Output: data/bundle/kanji.sqlite               (augments existing DB created by 02)

This is the core data for the "build a kanji from its radicals" game mechanic.

KRADFILE format (header lines start with '#'):
    <kanji> : <radical1> <radical2> <radical3> ...

Example:
    林 : 木 木
    休 : 人 木
    語 : 言 五 口

Tables added (drops & recreates if present):

    radicals(
        character     TEXT PRIMARY KEY,
        kanji_count   INTEGER NOT NULL    -- how many kanji use this radical
    )

    kanji_radicals(
        kanji_char    TEXT NOT NULL,
        radical_char  TEXT NOT NULL,
        count         INTEGER NOT NULL,   -- how many times this radical occurs in the kanji
        PRIMARY KEY (kanji_char, radical_char)
    )

Notes:
  - Some kradfile kanji are not present in our kanji table (KRADFILE covers
    JIS X 0208 ~6,355 chars; KANJIDIC2 has ~13,108). We KEEP those rows in
    kanji_radicals even when there's no kanji-table parent, because the
    radical-builder game may still want to surface uncommon kanji as bonus
    targets later. Counts of "orphan" rows are reported for visibility.
  - "Radical" here means a visual decomposition component (KRADFILE's notion),
    not the classical KangXi radical. Position info (left/right/etc.) is not
    in KRADFILE and is not stored here.

Usage:
    python scripts/03_parse_kradfile.py
"""

from __future__ import annotations

import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import Iterator

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
DB_PATH = PROJECT_ROOT / "data" / "bundle" / "kanji.sqlite"

KRADFILE_SOURCES = [
    RAW_DIR / "kradfile",
    RAW_DIR / "kradfile2",
]

SCHEMA = """
DROP TABLE IF EXISTS kanji_radicals;
DROP TABLE IF EXISTS radicals;

CREATE TABLE radicals (
    character    TEXT PRIMARY KEY,
    kanji_count  INTEGER NOT NULL
);

CREATE TABLE kanji_radicals (
    kanji_char    TEXT NOT NULL,
    radical_char  TEXT NOT NULL,
    count         INTEGER NOT NULL,
    PRIMARY KEY (kanji_char, radical_char)
);

CREATE INDEX idx_kr_radical ON kanji_radicals(radical_char);
"""


def iter_kradfile(path: Path) -> Iterator[tuple[str, list[str]]]:
    """Yield (kanji_char, [radical_char, ...]) for each non-comment line.

    KRADFILE is EUC-JP encoded; we decode here and never store the raw bytes.
    """
    with path.open("rb") as f:
        for raw in f:
            try:
                line = raw.decode("euc-jp").rstrip("\r\n")
            except UnicodeDecodeError:
                continue
            if not line or line.startswith("#"):
                continue
            # Format: "<kanji> : <r1> <r2> ..."
            head, sep, tail = line.partition(":")
            if not sep:
                continue
            kanji_char = head.strip()
            if len(kanji_char) != 1:
                # Defensive: kradfile lines always have a single CJK char on the left.
                continue
            radicals = tail.split()
            if not radicals:
                continue
            yield kanji_char, radicals


def main() -> int:
    if not DB_PATH.exists():
        print(
            f"ERROR: {DB_PATH} not found.\n"
            "Run scripts/02_parse_kanjidic.py first.",
            file=sys.stderr,
        )
        return 1

    missing = [p for p in KRADFILE_SOURCES if not p.exists()]
    if missing:
        names = ", ".join(p.name for p in missing)
        print(
            f"ERROR: missing source file(s): {names}\n"
            "Run scripts/01_download_sources.py (with --source kradfile).",
            file=sys.stderr,
        )
        return 1

    # Aggregate (kanji, radical) counts across both kradfile and kradfile2.
    # If both files mention the same kanji, kradfile2 entries are MERGED in
    # (max of the two counts per radical) — kradfile2 is an extension, not a
    # replacement.
    per_kanji: dict[str, Counter[str]] = {}
    per_source_counts: dict[str, int] = {}

    for src in KRADFILE_SOURCES:
        kanji_in_this_source = 0
        for kanji_char, radicals in iter_kradfile(src):
            cur = per_kanji.setdefault(kanji_char, Counter())
            file_count = Counter(radicals)
            # Take element-wise max so kradfile2 doesn't double-count a kanji
            # also present in kradfile.
            for r, c in file_count.items():
                if cur[r] < c:
                    cur[r] = c
            kanji_in_this_source += 1
        per_source_counts[src.name] = kanji_in_this_source
        print(f"  {src.name}: {kanji_in_this_source:,} kanji entries")

    print(f"  merged:   {len(per_kanji):,} unique kanji")

    # Build radicals table from the aggregated data.
    radical_kanji_count: Counter[str] = Counter()
    kanji_radical_rows: list[tuple[str, str, int]] = []
    for kanji_char, rad_counts in per_kanji.items():
        for radical_char, count in rad_counts.items():
            radical_kanji_count[radical_char] += 1
            kanji_radical_rows.append((kanji_char, radical_char, count))

    print(f"  radicals: {len(radical_kanji_count):,} distinct")
    print(f"  edges:    {len(kanji_radical_rows):,} (kanji,radical) pairs")

    print(f"\nWriting tables into {DB_PATH.relative_to(PROJECT_ROOT)} ...")
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(SCHEMA)
        conn.executemany(
            "INSERT INTO radicals (character, kanji_count) VALUES (?, ?)",
            sorted(radical_kanji_count.items()),
        )
        conn.executemany(
            "INSERT INTO kanji_radicals (kanji_char, radical_char, count) VALUES (?, ?, ?)",
            kanji_radical_rows,
        )
        conn.commit()

        # Sanity reports.
        total_radicals = conn.execute("SELECT COUNT(*) FROM radicals").fetchone()[0]
        total_edges = conn.execute("SELECT COUNT(*) FROM kanji_radicals").fetchone()[0]

        orphan_kanji = conn.execute(
            """SELECT COUNT(DISTINCT kr.kanji_char)
               FROM kanji_radicals kr
               LEFT JOIN kanji k ON k.character = kr.kanji_char
               WHERE k.character IS NULL"""
        ).fetchone()[0]
        covered_kanji = conn.execute(
            """SELECT COUNT(DISTINCT kr.kanji_char)
               FROM kanji_radicals kr
               INNER JOIN kanji k ON k.character = kr.kanji_char"""
        ).fetchone()[0]

        top_radicals = conn.execute(
            "SELECT character, kanji_count FROM radicals ORDER BY kanji_count DESC LIMIT 10"
        ).fetchall()

        sample_kanji = conn.execute(
            """SELECT k.character, GROUP_CONCAT(kr.radical_char || 'x' || kr.count, ' ')
               FROM kanji k
               JOIN kanji_radicals kr ON kr.kanji_char = k.character
               WHERE k.jlpt_old = 4
               GROUP BY k.character
               ORDER BY k.frequency_rank IS NULL, k.frequency_rank
               LIMIT 8"""
        ).fetchall()

        print(f"\n=== radicals & kanji_radicals ===")
        print(f"  radicals:        {total_radicals:,}")
        print(f"  edges:           {total_edges:,}")
        print(f"  kanji covered:   {covered_kanji:,} (in kanji table)")
        print(f"  kanji orphan:    {orphan_kanji:,} (not in kanji table)")
        print(f"  db size:         {DB_PATH.stat().st_size:,} bytes")
        print(f"\nTop 10 radicals by kanji count:")
        for c, n in top_radicals:
            print(f"  {c}  -> {n:,} kanji")
        print(f"\nSample decompositions (old JLPT 4, ~N5):")
        for c, decomp in sample_kanji:
            print(f"  {c}  =  {decomp}")

    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
