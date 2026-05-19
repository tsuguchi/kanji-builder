#!/usr/bin/env python3
"""Parse KANJIDIC2 XML and emit a normalized SQLite database.

Input:  data/raw/kanjidic2.xml
Output: data/bundle/kanji.sqlite

Schema (MVP):
    kanji(
        character          TEXT PRIMARY KEY,    -- the kanji character itself
        stroke_count       INTEGER NOT NULL,    -- number of strokes
        jlpt_old           INTEGER,             -- old JLPT 1-4 (1=hardest, 4=easiest), NULL if not graded
        jouyou_grade       INTEGER,             -- 1-6 elementary, 8 secondary, 9-10 jinmeiyo, NULL otherwise
        frequency_rank     INTEGER,             -- newspaper frequency rank 1-2500, NULL if outside top 2500
        meanings_en        TEXT NOT NULL,       -- JSON array of English meanings
        onyomi             TEXT NOT NULL,       -- JSON array (katakana, may include dotted forms like ア.ク)
        kunyomi            TEXT NOT NULL,       -- JSON array (hiragana, may include okurigana split by '.')
        radical_classical  INTEGER              -- KangXi classical radical 1-214
    )

Notes:
  - "jlpt_old" is the pre-2010 JLPT level present in KANJIDIC2. The modern
    N5-N1 mapping is NOT in this file; it will be added via a separate
    Tanos-derived list in a later pipeline step. Rough proxy:
        old 4 -> ~N5, old 3 -> ~N4, old 2 -> ~N3/N2, old 1 -> ~N2/N1
  - meanings_en filters out non-English `<meaning m_lang="...">` entries.
  - JSON columns let us keep arrays inline without an explosion of join tables
    at this stage; GRDB on the Swift side will decode them on read.

Usage:
    python scripts/02_parse_kanjidic.py
"""

from __future__ import annotations

import contextlib
import json
import sqlite3
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import TypedDict

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SRC = PROJECT_ROOT / "data" / "raw" / "kanjidic2.xml"
DST = PROJECT_ROOT / "data" / "bundle" / "kanji.sqlite"

SCHEMA = """
CREATE TABLE kanji (
    character          TEXT PRIMARY KEY,
    stroke_count       INTEGER NOT NULL,
    jlpt_old           INTEGER,
    jouyou_grade       INTEGER,
    frequency_rank     INTEGER,
    meanings_en        TEXT NOT NULL,
    onyomi             TEXT NOT NULL,
    kunyomi            TEXT NOT NULL,
    radical_classical  INTEGER
);
CREATE INDEX idx_kanji_jlpt  ON kanji(jlpt_old);
CREATE INDEX idx_kanji_grade ON kanji(jouyou_grade);
CREATE INDEX idx_kanji_freq  ON kanji(frequency_rank);
"""


class KanjiRow(TypedDict):
    character: str
    stroke_count: int
    jlpt_old: int | None
    jouyou_grade: int | None
    frequency_rank: int | None
    meanings_en: str
    onyomi: str
    kunyomi: str
    radical_classical: int | None


def _int_or_none(elem: ET.Element | None) -> int | None:
    if elem is None or elem.text is None:
        return None
    try:
        return int(elem.text)
    except ValueError:
        return None


def extract_kanji(char_elem: ET.Element) -> KanjiRow | None:
    literal = char_elem.findtext("literal")
    if not literal:
        return None

    misc = char_elem.find("misc")
    if misc is None:
        return None

    stroke_count = _int_or_none(misc.find("stroke_count"))
    if stroke_count is None:
        # KANJIDIC2 occasionally has variant stroke counts; take the first.
        first_stroke = misc.find("stroke_count")
        if first_stroke is not None and first_stroke.text:
            try:
                stroke_count = int(first_stroke.text)
            except ValueError:
                return None
        else:
            return None

    grade = _int_or_none(misc.find("grade"))
    freq = _int_or_none(misc.find("freq"))
    jlpt = _int_or_none(misc.find("jlpt"))

    radical: int | None = None
    radical_elem = char_elem.find("radical")
    if radical_elem is not None:
        for rv in radical_elem.findall("rad_value"):
            if rv.get("rad_type") == "classical" and rv.text:
                with contextlib.suppress(ValueError):
                    radical = int(rv.text)
                break

    onyomi: list[str] = []
    kunyomi: list[str] = []
    meanings_en: list[str] = []

    rm = char_elem.find("reading_meaning")
    if rm is not None:
        for rmgroup in rm.findall("rmgroup"):
            for reading in rmgroup.findall("reading"):
                r_type = reading.get("r_type")
                text = reading.text
                if not text:
                    continue
                if r_type == "ja_on":
                    onyomi.append(text)
                elif r_type == "ja_kun":
                    kunyomi.append(text)
            for meaning in rmgroup.findall("meaning"):
                # No m_lang attribute => English (default).
                if meaning.get("m_lang") is None and meaning.text:
                    meanings_en.append(meaning.text)

    return KanjiRow(
        character=literal,
        stroke_count=stroke_count,
        jlpt_old=jlpt,
        jouyou_grade=grade,
        frequency_rank=freq,
        meanings_en=json.dumps(meanings_en, ensure_ascii=False),
        onyomi=json.dumps(onyomi, ensure_ascii=False),
        kunyomi=json.dumps(kunyomi, ensure_ascii=False),
        radical_classical=radical,
    )


def main() -> int:
    if not SRC.exists():
        print(
            f"ERROR: {SRC} not found.\nRun scripts/01_download_sources.py first.",
            file=sys.stderr,
        )
        return 1

    DST.parent.mkdir(parents=True, exist_ok=True)
    if DST.exists():
        DST.unlink()

    print(f"Parsing {SRC.name} ({SRC.stat().st_size:,} bytes) ...")
    tree = ET.parse(SRC)
    root = tree.getroot()

    rows: list[KanjiRow] = []
    skipped = 0
    for char_elem in root.findall("character"):
        row = extract_kanji(char_elem)
        if row is None:
            skipped += 1
            continue
        rows.append(row)

    print(f"  parsed:  {len(rows):,} kanji")
    if skipped:
        print(f"  skipped: {skipped:,} entries (no literal/stroke_count)")

    print(f"\nWriting {DST.relative_to(PROJECT_ROOT)} ...")
    conn = sqlite3.connect(DST)
    try:
        conn.executescript(SCHEMA)
        conn.executemany(
            """INSERT INTO kanji
               (character, stroke_count, jlpt_old, jouyou_grade, frequency_rank,
                meanings_en, onyomi, kunyomi, radical_classical)
               VALUES
               (:character, :stroke_count, :jlpt_old, :jouyou_grade, :frequency_rank,
                :meanings_en, :onyomi, :kunyomi, :radical_classical)""",
            rows,
        )
        conn.commit()

        total = conn.execute("SELECT COUNT(*) FROM kanji").fetchone()[0]
        jlpt_dist = conn.execute("SELECT jlpt_old, COUNT(*) FROM kanji GROUP BY jlpt_old ORDER BY jlpt_old").fetchall()
        grade_dist = conn.execute(
            "SELECT jouyou_grade, COUNT(*) FROM kanji GROUP BY jouyou_grade ORDER BY jouyou_grade"
        ).fetchall()
        sample_n5_ish = conn.execute(
            """SELECT character, stroke_count, meanings_en
               FROM kanji
               WHERE jlpt_old = 4
               ORDER BY frequency_rank IS NULL, frequency_rank
               LIMIT 5"""
        ).fetchall()

        print(f"\n=== {DST.name} ===")
        print(f"  total kanji:     {total:,}")
        print(f"  by old JLPT:     {jlpt_dist}")
        print(f"  by jouyou grade: {grade_dist}")
        print(f"  file size:       {DST.stat().st_size:,} bytes")
        print("\nSample (old JLPT level 4, ~N5):")
        for c, sc, m in sample_n5_ish:
            print(f"  {c}  strokes={sc}  meanings={m}")

    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
