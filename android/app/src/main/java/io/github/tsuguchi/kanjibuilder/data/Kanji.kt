package io.github.tsuguchi.kanjibuilder.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One kanji character with KANJIDIC2-derived facts and the post-2010 JLPT level
 * applied by the Python pipeline (scripts/04_apply_jlpt_new.py).
 *
 * The JSON-encoded list columns (`meanings_en`, `onyomi`, `kunyomi`) are read
 * as plain strings here — decode at the use site (e.g. via kotlinx.serialization
 * or a quick split) when you need the array. Storing them as JSON strings keeps
 * the SQLite schema stable across iOS/Android consumers without join tables.
 */
@Entity(
    tableName = "kanji",
    indices = [
        Index(value = ["jlpt_old"], name = "idx_kanji_jlpt"),
        Index(value = ["jouyou_grade"], name = "idx_kanji_grade"),
        Index(value = ["frequency_rank"], name = "idx_kanji_freq"),
        Index(value = ["jlpt_new"], name = "idx_kanji_jlpt_new"),
    ],
)
data class Kanji(
    @PrimaryKey val character: String,
    @ColumnInfo(name = "stroke_count")     val strokeCount: Int,
    @ColumnInfo(name = "jlpt_old")          val jlptOld: Int?,
    @ColumnInfo(name = "jouyou_grade")      val jouyouGrade: Int?,
    @ColumnInfo(name = "frequency_rank")    val frequencyRank: Int?,
    @ColumnInfo(name = "meanings_en")       val meaningsEnJson: String,
    @ColumnInfo(name = "onyomi")            val onyomiJson: String,
    @ColumnInfo(name = "kunyomi")           val kunyomiJson: String,
    @ColumnInfo(name = "radical_classical") val radicalClassical: Int?,
    @ColumnInfo(name = "jlpt_new")          val jlptNew: Int?,
)
