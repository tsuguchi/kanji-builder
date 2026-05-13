#!/usr/bin/env python3
"""Apply modern JLPT (N5-N1) level mapping to the kanji table.

Input:  data/raw/kanji-data.json   (from davidluzgouveia/kanji-data, MIT)
Output: data/bundle/kanji.sqlite   (adds jlpt_new column to existing kanji table)

Why this step exists:
    KANJIDIC2 only contains the pre-2010 JLPT levels (1-4) in its <jlpt> field.
    The post-2010 JLPT (N1-N5) has NO official kanji list published by JEES
    or the Japan Foundation. The kanji-data project combines KANJIDIC,
    WaniKani, and community sources into a widely-used unofficial mapping;
    this is what most modern Japanese-learning apps rely on.

Mapping convention:
    jlpt_new = 5  -> N5 (easiest)
    jlpt_new = 4  -> N4
    jlpt_new = 3  -> N3
    jlpt_new = 2  -> N2
    jlpt_new = 1  -> N1 (hardest)
    jlpt_new = NULL -> not in the JLPT scope

The MVP N5 stage set will be `SELECT character FROM kanji WHERE jlpt_new = 5`.

Notes:
  - Idempotent: column is added on first run, UPDATEs overwrite existing
    values on re-run.
  - Kanji present in kanji-data.json but missing from our kanji table are
    silently skipped (the JSON includes a few rare chars beyond KANJIDIC2).
  - Kanji in our table absent from kanji-data.json receive jlpt_new = NULL.

Usage:
    python scripts/04_apply_jlpt_new.py
"""

from __future__ import annotations

import json
import sqlite3
import sys
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SRC_JSON = PROJECT_ROOT / "data" / "raw" / "kanji-data.json"
DB_PATH = PROJECT_ROOT / "data" / "bundle" / "kanji.sqlite"


def ensure_column(conn: sqlite3.Connection) -> bool:
    """Add jlpt_new column + index if not present. Returns True if added."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(kanji)").fetchall()}
    if "jlpt_new" in cols:
        return False
    conn.execute("ALTER TABLE kanji ADD COLUMN jlpt_new INTEGER")
    conn.execute("CREATE INDEX idx_kanji_jlpt_new ON kanji(jlpt_new)")
    return True


def main() -> int:
    if not DB_PATH.exists():
        print(
            f"ERROR: {DB_PATH} not found.\n"
            "Run scripts/02_parse_kanjidic.py first.",
            file=sys.stderr,
        )
        return 1

    if not SRC_JSON.exists():
        print(
            f"ERROR: {SRC_JSON} not found.\n"
            "Run scripts/01_download_sources.py (--source kanji-data).",
            file=sys.stderr,
        )
        return 1

    print(f"Loading {SRC_JSON.name} ({SRC_JSON.stat().st_size:,} bytes) ...")
    with SRC_JSON.open(encoding="utf-8") as f:
        data: dict[str, dict] = json.load(f)
    print(f"  entries: {len(data):,}")

    # Build (level, char) UPDATEs only for non-null jlpt_new.
    updates: list[tuple[int, str]] = []
    by_level: Counter[int] = Counter()
    for char, fields in data.items():
        lvl = fields.get("jlpt_new")
        if lvl is None:
            continue
        if not isinstance(lvl, int) or lvl < 1 or lvl > 5:
            print(f"  WARN: unexpected jlpt_new={lvl!r} for {char!r}, skipping")
            continue
        updates.append((lvl, char))
        by_level[lvl] += 1
    print(f"  with jlpt_new: {len(updates):,} kanji")
    print(f"  by level (src): " + ", ".join(f"N{l}={by_level[l]}" for l in sorted(by_level, reverse=True)))

    print(f"\nApplying to {DB_PATH.relative_to(PROJECT_ROOT)} ...")
    conn = sqlite3.connect(DB_PATH)
    try:
        added = ensure_column(conn)
        print(f"  jlpt_new column: {'added' if added else 'already present'}")

        # Reset for idempotency on re-run.
        conn.execute("UPDATE kanji SET jlpt_new = NULL")

        # Apply mapping. UPDATEs against unknown characters are simply no-ops.
        cur = conn.executemany(
            "UPDATE kanji SET jlpt_new = ? WHERE character = ?",
            updates,
        )
        affected = cur.rowcount
        conn.commit()

        skipped = len(updates) - affected
        print(f"  rows updated:   {affected:,}")
        if skipped > 0:
            print(f"  rows skipped:   {skipped:,} (kanji not in our kanji table)")

        # Sanity reports.
        applied = conn.execute(
            "SELECT jlpt_new, COUNT(*) FROM kanji WHERE jlpt_new IS NOT NULL "
            "GROUP BY jlpt_new ORDER BY jlpt_new DESC"
        ).fetchall()
        total_applied = sum(c for _, c in applied)
        total_kanji = conn.execute("SELECT COUNT(*) FROM kanji").fetchone()[0]

        cross_old = conn.execute(
            """SELECT jlpt_new, jlpt_old, COUNT(*)
               FROM kanji
               WHERE jlpt_new IS NOT NULL
               GROUP BY jlpt_new, jlpt_old
               ORDER BY jlpt_new DESC, jlpt_old"""
        ).fetchall()

        n5_sample = conn.execute(
            """SELECT character, meanings_en
               FROM kanji
               WHERE jlpt_new = 5
               ORDER BY frequency_rank IS NULL, frequency_rank
               LIMIT 10"""
        ).fetchall()

        print(f"\n=== jlpt_new distribution ===")
        for lvl, cnt in applied:
            print(f"  N{lvl}: {cnt:,}")
        print(f"  applied total:  {total_applied:,} / {total_kanji:,} kanji "
              f"({100 * total_applied / total_kanji:.1f}%)")
        print(f"  db size:        {DB_PATH.stat().st_size:,} bytes")

        print(f"\nCross-tab jlpt_new x jlpt_old (sanity check):")
        prev_new = None
        for n_new, n_old, cnt in cross_old:
            if n_new != prev_new:
                print(f"  N{n_new}:")
                prev_new = n_new
            label = f"old{n_old}" if n_old is not None else "(none)"
            print(f"    {label:>8} : {cnt:>4}")

        print(f"\nN5 sample (by frequency):")
        for c, meanings in n5_sample:
            print(f"  {c}  {meanings}")

    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
