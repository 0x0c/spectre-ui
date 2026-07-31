package dev.spectre.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * トークン名 -> 実際の色・書体・寸法の対応表。
 *
 * SDK はトークン名しか知らない。実体をホストアプリが注入することで、
 * ホストのデザインシステムにそのまま馴染み、ダークモードやフォントスケーリングも
 * ホスト側の仕組みに乗る (docs/architecture.md §6)。
 */
@Immutable
data class SpectreTheme(
    val colors: Map<String, Color>,
    val typography: Map<String, TextStyle>,
    val spacing: Map<String, Dp>,
    val radius: Map<String, Dp>,
    val icons: Map<String, ImageVector>,
) {
    fun color(token: String?, fallback: Color): Color =
        token?.let { colors[it] } ?: fallback

    fun textStyle(token: String?, fallback: TextStyle): TextStyle =
        token?.let { typography[it] } ?: fallback

    fun space(token: String?): Dp = token?.let { spacing[it] } ?: 0.dp

    fun corner(token: String?): Dp = token?.let { radius[it] } ?: 0.dp

    /** 未知のアイコン名は情報アイコンに落とす。描画が欠けるよりは何か出したほうがよい。 */
    fun icon(token: String?): ImageVector = token?.let { icons[it] } ?: Icons.Default.Info
}

val LocalSpectreTheme = staticCompositionLocalOf { spectreThemeFallback() }

/**
 * Material3 のテーマからトークン表を組み立てる既定実装。
 *
 * ホストアプリが独自のデザインシステムを持つ場合は、この形の [SpectreTheme] を
 * 自前で組み立てて [LocalSpectreTheme] に流し込めばよい。
 */
@Composable
@ReadOnlyComposable
fun spectreThemeFromMaterial(): SpectreTheme {
    val cs = MaterialTheme.colorScheme
    val ty = MaterialTheme.typography
    return SpectreTheme(
        colors = mapOf(
            "primary" to cs.primary,
            "onPrimary" to cs.onPrimary,
            "primaryContainer" to cs.primaryContainer,
            "onPrimaryContainer" to cs.onPrimaryContainer,
            "secondary" to cs.secondary,
            "onSecondary" to cs.onSecondary,
            "secondaryContainer" to cs.secondaryContainer,
            "onSecondaryContainer" to cs.onSecondaryContainer,
            "surface" to cs.surface,
            "onSurface" to cs.onSurface,
            "surfaceVariant" to cs.surfaceVariant,
            "onSurfaceVariant" to cs.onSurfaceVariant,
            "background" to cs.background,
            "onBackground" to cs.onBackground,
            "outline" to cs.outline,
            "outlineVariant" to cs.outlineVariant,
            "error" to cs.error,
            "onError" to cs.onError,
            // Material3 に対応する役割がないものは意味の近い色を割り当てる。
            // ホストアプリがブランドの成功色/警告色を持つなら上書きすればよい。
            "success" to SpectreDefaultColors.Success,
            "onSuccess" to Color.White,
            "warning" to SpectreDefaultColors.Warning,
            "onWarning" to Color.Black,
            "info" to cs.tertiary,
            "onInfo" to cs.onTertiary,
            "transparent" to Color.Transparent,
        ),
        typography = mapOf(
            "displayLg" to ty.displayMedium,
            "displayMd" to ty.displaySmall,
            "titleLg" to ty.headlineSmall,
            "titleMd" to ty.titleLarge,
            "titleSm" to ty.titleMedium,
            "bodyLg" to ty.bodyLarge,
            "bodyMd" to ty.bodyMedium,
            "bodySm" to ty.bodySmall,
            "label" to ty.labelLarge,
            "caption" to ty.labelSmall,
            "overline" to ty.labelSmall,
        ),
        spacing = SpectreDefaultSpacing,
        radius = SpectreDefaultRadius,
        icons = SpectreDefaultIcons,
    )
}

private object SpectreDefaultColors {
    val Success = Color(0xFF2E7D32)
    val Warning = Color(0xFFF9A825)
}

/** spec/component-manifest.json の tokens.spacing と一致していること。 */
internal val SpectreDefaultSpacing: Map<String, Dp> = mapOf(
    "none" to 0.dp,
    "xs" to 4.dp,
    "sm" to 8.dp,
    "md" to 16.dp,
    "lg" to 24.dp,
    "xl" to 32.dp,
    "xxl" to 48.dp,
)

/** `full` は完全な丸み。実際の描画では高さの半分に丸められる。 */
internal val SpectreDefaultRadius: Map<String, Dp> = mapOf(
    "none" to 0.dp,
    "sm" to 4.dp,
    "md" to 8.dp,
    "lg" to 16.dp,
    "xl" to 24.dp,
    "full" to 999.dp,
)

/**
 * IconToken -> Material Icons。
 *
 * SF Symbols と Material Symbols は名前も字形も一致しないため、Spectre 独自の
 * アイコン名前空間を定義し、プラットフォームごとに対応表を持つ
 * (docs/spec/components.md)。ここに無いトークンは情報アイコンに落ちる。
 */
internal val SpectreDefaultIcons: Map<String, ImageVector> = mapOf(
    "chevron.right" to Icons.Default.KeyboardArrowRight,
    "chevron.left" to Icons.Default.KeyboardArrowLeft,
    "chevron.up" to Icons.Default.KeyboardArrowUp,
    "chevron.down" to Icons.Default.KeyboardArrowDown,
    "arrow.back" to Icons.Default.ArrowBack,
    "arrow.forward" to Icons.Default.ArrowForward,
    "close" to Icons.Default.Close,
    "clear" to Icons.Default.Clear,
    "check" to Icons.Default.Check,
    "plus" to Icons.Default.Add,
    "search" to Icons.Default.Search,
    "filter" to Icons.Default.List,
    "sort" to Icons.Default.List,
    "list" to Icons.Default.List,
    "menu" to Icons.Default.Menu,
    "heart" to Icons.Default.FavoriteBorder,
    "heart.fill" to Icons.Default.Favorite,
    "star" to Icons.Default.Star,
    "star.fill" to Icons.Default.Star,
    "share" to Icons.Default.Share,
    "cart" to Icons.Default.ShoppingCart,
    "user" to Icons.Default.Person,
    "home" to Icons.Default.Home,
    "info" to Icons.Default.Info,
    "warning" to Icons.Default.Warning,
    "error" to Icons.Default.Warning,
    "success" to Icons.Default.CheckCircle,
    "lock" to Icons.Default.Lock,
    "calendar" to Icons.Default.DateRange,
    "clock" to Icons.Default.DateRange,
    "location" to Icons.Default.LocationOn,
    "mail" to Icons.Default.Email,
    "bell" to Icons.Default.Notifications,
    "settings" to Icons.Default.Settings,
    "refresh" to Icons.Default.Refresh,
    "trash" to Icons.Default.Delete,
    "edit" to Icons.Default.Edit,
    "more.vertical" to Icons.Default.MoreVert,
    "more.horizontal" to Icons.Default.MoreVert,
)

/**
 * Composable の外から参照される既定値。
 * [LocalSpectreTheme] の初期値としてのみ使い、実際の描画では
 * [spectreThemeFromMaterial] で置き換わる。
 */
internal fun spectreThemeFallback(): SpectreTheme = SpectreTheme(
    colors = emptyMap(),
    typography = emptyMap(),
    spacing = SpectreDefaultSpacing,
    radius = SpectreDefaultRadius,
    icons = SpectreDefaultIcons,
)
