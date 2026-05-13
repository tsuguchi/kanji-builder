package io.github.tsuguchi.kanjibuilder.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val LightColors = lightColorScheme(
    primary = SumiBlack,
    onPrimary = WashiCream,
    secondary = InkRed,
    tertiary = MossGreen,
    background = WashiCream,
    surface = WashiCream,
)

private val DarkColors = darkColorScheme(
    primary = SumiBlackDark,
    onPrimary = WashiCreamDark,
    secondary = InkRedDark,
    tertiary = MossGreenDark,
    background = WashiCreamDark,
    surface = WashiCreamDark,
)

@Composable
fun KanjiBuilderTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val ctx = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content,
    )
}
