#!/usr/bin/env python3
"""Parse JLPT vocab CSVs and emit `words` + `word_kanji` tables.

Input:  data/raw/jlpt-vocab-n{1..5}.csv  (from jamsinclair/open-anki-jlpt-decks, MIT)
Output: data/bundle/kanji.sqlite          (adds words + word_kanji tables)

Schema added:
    words(
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        expression    TEXT NOT NULL,        -- "学生", "明るい", "送り込む"
        reading       TEXT NOT NULL,        -- "がくせい", "あかるい", "おくりこむ"
        meanings_en   TEXT NOT NULL,        -- JSON array of English glosses
        jlpt_new      INTEGER NOT NULL,     -- 5..1
        source_guid   TEXT                  -- anki guid (debug + stable key for future SRS)
    )
    word_kanji(
        word_id       INTEGER NOT NULL,
        kanji_char    TEXT NOT NULL,
        position      INTEGER NOT NULL,     -- kanji-only order 0,1,2... (okurigana ignored)
        PRIMARY KEY (word_id, position)
    )

Filters:
  - The JLPT level is taken from the source FILENAME (n5.csv → N5 etc.),
    NOT from the per-row tags. jamsinclair's data is inconsistent: N5/N4
    rows carry a `JLPT_N{5,4}` tag, but N3/N2/N1 rows only carry the legacy
    `JLPT_{3,2,1}` 4-level tag (no `JLPT_N3`/`JLPT_N2`/`JLPT_N1`). The
    filename is the authoritative level marker — every row in nX.csv is an
    Nx-tagged entry by construction.
  - Rows must carry the generic `JLPT` tag as a sanity check (filters out
    any data rows the maintainer hasn't promoted yet).
  - expression MUST contain at least one CJK kanji (purely kana words —
    e.g. "ああ", "あさって" — are dropped, per the project scope decision).
  - word_kanji rows are only emitted for kanji that exist in the `kanji`
    table. A word whose kanji are partially unknown is still kept in
    `words`, but the unknown positions are silently dropped from
    `word_kanji`. This keeps the display layer simple while letting SRS
    later treat such words as "no constituent kanji to pair with."

Notes:
  - JLPT has no official vocab list. jamsinclair derives from Tanos.co.uk
    (Jonathan Waller). Caveats inherit. See [[project-word-puzzles-plan]].
  - Idempotent: tables are DROPped + recreated on each run.
  - The CSV uses `;` (semicolon) as the multi-sense divider inside the
    meaning cell. Each sense is trimmed and kept as a separate array entry.

Usage:
    python scripts/05_parse_jlpt_vocab.py
"""

from __future__ import annotations

import csv
import json
import re
import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import TypedDict

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
DB_PATH = PROJECT_ROOT / "data" / "bundle" / "kanji.sqlite"

# CJK Unified Ideographs. We deliberately do NOT include Extension A
# (U+3400–U+4DBF) or Compatibility Ideographs (U+F900–U+FAFF) — they would
# not appear in any modern JLPT vocab list, and excluding them keeps the
# "is this a kanji?" check inexpensive.
_KANJI_RE = re.compile(r"[一-鿿]")

SCHEMA = """
DROP TABLE IF EXISTS word_kanji;
DROP TABLE IF EXISTS words;

CREATE TABLE words (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    expression   TEXT NOT NULL,
    reading      TEXT NOT NULL,
    meanings_en  TEXT NOT NULL,
    jlpt_new     INTEGER NOT NULL,
    source_guid  TEXT
);
CREATE INDEX idx_words_jlpt_new ON words(jlpt_new);

CREATE TABLE word_kanji (
    word_id    INTEGER NOT NULL,
    kanji_char TEXT NOT NULL,
    position   INTEGER NOT NULL,
    PRIMARY KEY (word_id, position)
);
CREATE INDEX idx_word_kanji_kanji ON word_kanji(kanji_char);
"""


class WordRow(TypedDict):
    expression: str
    reading: str
    meanings_en: str
    jlpt_new: int
    source_guid: str | None


def _split_meanings(meaning_cell: str) -> list[str]:
    """Split the CSV `meaning` cell into individual sense strings.

    The cell uses `;` to separate distinct senses. Comma inside a single
    sense (e.g. "to meet, to see") is part of that sense — not a separator.
    """
    parts = [p.strip() for p in meaning_cell.split(";")]
    return [p for p in parts if p]


def parse_csv(
    path: Path, level: int, known_kanji: set[str]
) -> tuple[list[WordRow], list[list[tuple[str, int]]], Counter[str]]:
    """Parse one level's CSV.

    Returns (word_rows, per_word_kanji_positions, stats) where
    `per_word_kanji_positions[i]` is the list of (kanji_char, position) for
    word_rows[i] — already filtered to kanji present in `known_kanji`.
    """
    stats: Counter[str] = Counter()

    word_rows: list[WordRow] = []
    per_word_kanji: list[list[tuple[str, int]]] = []

    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            stats["read"] += 1

            tags = (row.get("tags") or "").split()
            # Sanity check only: the file name says the level. We just want
            # to drop any row that isn't tagged as JLPT-something at all.
            if "JLPT" not in tags:
                stats["no_jlpt_tag"] += 1
                continue

            expression = (row.get("expression") or "").strip()
            reading = (row.get("reading") or "").strip()
            meaning = (row.get("meaning") or "").strip()
            guid = (row.get("guid") or "").strip() or None

            if not expression or not reading or not meaning:
                stats["missing_fields"] += 1
                continue

            kanji_positions: list[tuple[str, int]] = []
            position = 0
            for ch in expression:
                if _KANJI_RE.match(ch):
                    if ch in known_kanji:
                        kanji_positions.append((ch, position))
                    else:
                        stats["unknown_kanji"] += 1
                    position += 1

            if position == 0:
                # No kanji at all — pure kana word, skip per scope.
                stats["kana_only"] += 1
                continue

            word_rows.append(
                WordRow(
                    expression=expression,
                    reading=reading,
                    meanings_en=json.dumps(_split_meanings(meaning), ensure_ascii=False),
                    jlpt_new=level,
                    source_guid=guid,
                )
            )
            per_word_kanji.append(kanji_positions)
            stats["kept"] += 1

    return word_rows, per_word_kanji, stats


def main() -> int:
    if not DB_PATH.exists():
        print(
            f"ERROR: {DB_PATH} not found.\nRun scripts/02_parse_kanjidic.py (and 03/04) first.",
            file=sys.stderr,
        )
        return 1

    csv_paths = {lvl: RAW_DIR / f"jlpt-vocab-n{lvl}.csv" for lvl in (5, 4, 3, 2, 1)}
    missing = [p for p in csv_paths.values() if not p.exists()]
    if missing:
        print(
            "ERROR: vocab CSVs missing:\n  "
            + "\n  ".join(str(p) for p in missing)
            + "\nRun scripts/01_download_sources.py first.",
            file=sys.stderr,
        )
        return 1

    print(f"Reading {DB_PATH.relative_to(PROJECT_ROOT)} for known kanji ...")
    conn = sqlite3.connect(DB_PATH)
    try:
        known_kanji = {r[0] for r in conn.execute("SELECT character FROM kanji").fetchall()}
        print(f"  known kanji: {len(known_kanji):,}")

        all_word_rows: list[WordRow] = []
        all_kanji_positions: list[list[tuple[str, int]]] = []
        total_stats: Counter[str] = Counter()
        per_level_kept: Counter[int] = Counter()

        for level, path in csv_paths.items():
            print(f"\nParsing {path.name} ...")
            word_rows, kanji_positions, stats = parse_csv(path, level, known_kanji)
            print(
                f"  read={stats['read']:>5}  kept={stats['kept']:>5}  "
                f"kana_only={stats['kana_only']:>4}  "
                f"no_jlpt_tag={stats['no_jlpt_tag']:>3}  "
                f"missing_fields={stats['missing_fields']:>3}  "
                f"unknown_kanji={stats['unknown_kanji']:>3}"
            )
            all_word_rows.extend(word_rows)
            all_kanji_positions.extend(kanji_positions)
            total_stats.update(stats)
            per_level_kept[level] = stats["kept"]

        print(f"\nWriting words + word_kanji to {DB_PATH.relative_to(PROJECT_ROOT)} ...")
        conn.executescript(SCHEMA)

        word_id_offset = 1  # AUTOINCREMENT starts at 1 on a fresh table.
        conn.executemany(
            """INSERT INTO words (expression, reading, meanings_en, jlpt_new, source_guid)
               VALUES (:expression, :reading, :meanings_en, :jlpt_new, :source_guid)""",
            all_word_rows,
        )

        # Build word_kanji rows. The i-th word inserted got id = word_id_offset + i.
        wk_rows: list[tuple[int, str, int]] = []
        for i, positions in enumerate(all_kanji_positions):
            word_id = word_id_offset + i
            for kanji_char, position in positions:
                wk_rows.append((word_id, kanji_char, position))

        conn.executemany(
            "INSERT INTO word_kanji (word_id, kanji_char, position) VALUES (?, ?, ?)",
            wk_rows,
        )
        conn.commit()

        # Sanity reports.
        words_total = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
        wk_total = conn.execute("SELECT COUNT(*) FROM word_kanji").fetchone()[0]
        by_level = conn.execute(
            "SELECT jlpt_new, COUNT(*) FROM words GROUP BY jlpt_new ORDER BY jlpt_new DESC"
        ).fetchall()

        sample_n5 = conn.execute(
            """SELECT expression, reading, meanings_en
               FROM words
               WHERE jlpt_new = 5
               ORDER BY length(expression), expression
               LIMIT 8"""
        ).fetchall()

        # Top kanji by word count (sanity: 日, 一, 大 etc. should be on top).
        top_kanji = conn.execute(
            """SELECT kanji_char, COUNT(*) AS n
               FROM word_kanji
               GROUP BY kanji_char
               ORDER BY n DESC
               LIMIT 10"""
        ).fetchall()

        print("\n=== words / word_kanji ===")
        print(f"  total words:      {words_total:,}")
        print(f"  total word_kanji: {wk_total:,}")
        print("  by level:")
        for lvl, cnt in by_level:
            print(f"    N{lvl}: {cnt:,}")
        print(f"  db size:          {DB_PATH.stat().st_size:,} bytes")

        print("\nN5 sample (shortest first):")
        for expr, rd, m in sample_n5:
            print(f"  {expr}  ({rd})  {m}")

        print("\nTop kanji by vocab count:")
        for c, n in top_kanji:
            print(f"  {c}  -> {n} words")

    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
