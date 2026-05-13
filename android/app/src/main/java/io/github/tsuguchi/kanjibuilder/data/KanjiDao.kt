package io.github.tsuguchi.kanjibuilder.data

import androidx.room.Dao
import androidx.room.Query

/**
 * Read-only access to the bundled kanji database. All queries are static
 * reference data — user progress lives in a separate Room database (TODO).
 */
@Dao
interface KanjiDao {

    @Query("SELECT COUNT(*) FROM kanji")
    suspend fun countKanji(): Int

    @Query("SELECT COUNT(*) FROM kanji WHERE jlpt_new = :level")
    suspend fun countByJlptNew(level: Int): Int

    @Query("SELECT COUNT(*) FROM radicals")
    suspend fun countRadicals(): Int

    @Query("SELECT COUNT(*) FROM kanji_radicals")
    suspend fun countEdges(): Int

    /**
     * N5 kanji ordered by newspaper frequency (rarer ones — without a rank —
     * sink to the bottom). Used by the smoke-test screen and as the starting
     * point for the N5 stage content.
     */
    @Query(
        """
        SELECT * FROM kanji
        WHERE jlpt_new = 5
        ORDER BY frequency_rank IS NULL, frequency_rank
        """
    )
    suspend fun n5KanjiByFrequency(): List<Kanji>
}
