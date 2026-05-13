package io.github.tsuguchi.kanjibuilder.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index

/**
 * M:N edge between a kanji and one of its visual radicals.
 * `count` is the number of times this radical appears in the kanji
 * (e.g. 林 → 木 with count = 2).
 *
 * Primary key is the composite (kanji_char, radical_char). The index on
 * `radical_char` powers the "which kanji use this radical?" query — the
 * primary lookup driving the radical-palette UI.
 */
@Entity(
    tableName = "kanji_radicals",
    primaryKeys = ["kanji_char", "radical_char"],
    indices = [Index(value = ["radical_char"], name = "idx_kr_radical")],
)
data class KanjiRadical(
    @ColumnInfo(name = "kanji_char")   val kanjiChar: String,
    @ColumnInfo(name = "radical_char") val radicalChar: String,
    @ColumnInfo(name = "count")        val count: Int,
)
