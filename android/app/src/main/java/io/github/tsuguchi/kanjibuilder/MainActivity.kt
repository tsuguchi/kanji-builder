package io.github.tsuguchi.kanjibuilder

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import io.github.tsuguchi.kanjibuilder.ui.screens.SmokeTestScreen
import io.github.tsuguchi.kanjibuilder.ui.theme.KanjiBuilderTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            KanjiBuilderTheme {
                SmokeTestScreen()
            }
        }
    }
}
