package io.github.tsuguchi.kanjibuilder.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A visual radical extracted from KRADFILE (the decomposition primitives used
 * for the kanji-building game mechanic). NOT the same set as the 214 classical
 * KangXi radicals — `kanji.radical_classical` holds that for KANJIDIC2-listed
 * kanji separately.
 */
@Entity(tableName = "radicals")
data class Radical(
    @PrimaryKey val character: String,
    @ColumnInfo(name = "kanji_count") val kanjiCount: Int,
)
