package io.github.tsuguchi.kanjibuilder.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.github.tsuguchi.kanjibuilder.R
import io.github.tsuguchi.kanjibuilder.data.Kanji
import io.github.tsuguchi.kanjibuilder.data.KanjiDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Database smoke-test screen. Confirms that:
 *   1. kanji.sqlite shipped in assets/ is readable from Room.
 *   2. Schema declared in entities matches the Python-pipeline output.
 *   3. The N5 set has the expected ~79 kanji.
 *
 * Throwaway UI — the proper home screen / stage list replaces this later.
 */
@Composable
fun SmokeTestScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var state by remember { mutableStateOf<SmokeState>(SmokeState.Loading) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        scope.launch {
            state = try {
                val db = KanjiDatabase.get(ctx)
                val dao = db.kanjiDao()
                withContext(Dispatchers.IO) {
                    SmokeState.Loaded(
                        totalKanji   = dao.countKanji(),
                        n5Kanji      = dao.countByJlptNew(5),
                        radicalCount = dao.countRadicals(),
                        edgeCount    = dao.countEdges(),
                        n5Sample     = dao.n5KanjiByFrequency().take(20),
                    )
                }
            } catch (t: Throwable) {
                SmokeState.Error(t.message ?: t::class.java.simpleName)
            }
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        when (val s = state) {
            is SmokeState.Loading -> Centered {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.smoke_loading))
            }
            is SmokeState.Error -> Centered {
                Text(
                    text = stringResource(R.string.smoke_error, s.message),
                    color = MaterialTheme.colorScheme.error,
                )
            }
            is SmokeState.Loaded -> LoadedView(s)
        }
    }
}

@Composable
private fun LoadedView(s: SmokeState.Loaded) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = stringResource(R.string.smoke_title),
            style = MaterialTheme.typography.titleLarge,
        )
        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.smoke_summary_kanji,    s.totalKanji))
        Text(stringResource(R.string.smoke_summary_n5,       s.n5Kanji))
        Text(stringResource(R.string.smoke_summary_radicals, s.radicalCount))
        Text(stringResource(R.string.smoke_summary_edges,    s.edgeCount))
        Spacer(Modifier.height(24.dp))
        Text(
            text = stringResource(R.string.smoke_n5_sample),
            style = MaterialTheme.typography.titleLarge,
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(top = 12.dp),
        ) {
            items(s.n5Sample, key = Kanji::character) { k ->
                Text(text = k.character, style = MaterialTheme.typography.titleLarge)
            }
        }
    }
}

@Composable
private fun Centered(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) { content() }
    }
}

private sealed interface SmokeState {
    data object Loading : SmokeState
    data class Error(val message: String) : SmokeState
    data class Loaded(
        val totalKanji: Int,
        val n5Kanji: Int,
        val radicalCount: Int,
        val edgeCount: Int,
        val n5Sample: List<Kanji>,
    ) : SmokeState
}
