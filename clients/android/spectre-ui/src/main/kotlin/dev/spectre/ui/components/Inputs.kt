package dev.spectre.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import dev.spectre.core.RenderNode
import dev.spectre.core.SpValue
import dev.spectre.core.asDoubleOrNull
import dev.spectre.core.isTruthy
import dev.spectre.core.stringify
import dev.spectre.ui.LocalSpectreController
import dev.spectre.ui.LocalSpectreTheme
import dev.spectre.ui.SpectreOption
import dev.spectre.ui.a11yLabel
import dev.spectre.ui.bool
import dev.spectre.ui.float
import dev.spectre.ui.floatOrNull
import dev.spectre.ui.int
import dev.spectre.ui.intOrNull
import dev.spectre.ui.options
import dev.spectre.ui.spectreNode
import dev.spectre.ui.string
import dev.spectre.ui.stringOrNull
import dev.spectre.ui.token

@Composable
fun ButtonView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val controller = LocalSpectreController.current
    val label = node.string("label")
    val loading = node.bool("loading", false)
    // loading 中はタップを無効化する。多重発火の防止は ActionDispatcher 側でも行うが、
    // 押せてしまうこと自体が誤操作の原因になるので UI でも止める。
    val enabled = node.bool("enabled", true) && !loading
    val onTap = { controller.dispatch(node.actions("onTap")) }
    val variant = node.token("variant", "primary")

    val content: @Composable () -> Unit = {
        Row(
            horizontalArrangement = Arrangement.spacedBy(theme.space("xs")),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            } else {
                node.stringOrNull("leadingIcon")?.let {
                    Icon(theme.icon(it), contentDescription = null, modifier = Modifier.size(18.dp))
                }
            }
            if (label.isNotEmpty()) Text(label)
            node.stringOrNull("trailingIcon")?.let {
                Icon(theme.icon(it), contentDescription = null, modifier = Modifier.size(18.dp))
            }
        }
    }

    val base = modifier.spectreNode(node).applyA11y(node)

    when (variant) {
        "secondary" -> OutlinedButton(onTap, base, enabled = enabled) { content() }
        "tertiary", "text" -> TextButton(onTap, base, enabled = enabled) { content() }
        "destructive" -> Button(
            onTap,
            base,
            enabled = enabled,
            colors = ButtonDefaults.buttonColors(
                containerColor = theme.color("error", MaterialTheme.colorScheme.error),
                contentColor = theme.color("onError", MaterialTheme.colorScheme.onError),
            ),
        ) { content() }
        else -> {
            // ラベルが空でアイコンだけのボタンは IconButton に落とす。
            // a11y.label はリントで必須になっているため、ここでは指定を反映するだけ。
            val iconOnly = label.isEmpty() && node.stringOrNull("leadingIcon") != null
            if (iconOnly) {
                IconButton(onTap, base, enabled = enabled) {
                    Icon(theme.icon(node.stringOrNull("leadingIcon")), contentDescription = node.a11yLabel())
                }
            } else {
                Button(onTap, base, enabled = enabled) { content() }
            }
        }
    }
}

@Composable
fun TextFieldView(node: RenderNode, modifier: Modifier) {
    val controller = LocalSpectreController.current
    val bindTo = node.stringOrNull("bindTo") ?: return
    val bound = controller.stateValue(bindTo).let { if (it is SpValue.Null) "" else it.stringify() }

    // 入力中は自前の状態で追従し、確定後に state へ反映する。
    // state 経由だと再解決のたびにカーソル位置が飛ぶため。
    var text by remember(bindTo) { mutableStateOf(bound) }
    LaunchedEffect(bound) { if (bound != text) text = bound }

    val debounceMs = node.int("debounceMs", 300)
    val onChange = node.actions("onChange")

    // onChange はデバウンス後に発火する。1文字ごとにサーバへ飛ばさないための既定値。
    LaunchedEffect(text, onChange.isNotEmpty()) {
        if (onChange.isEmpty() || text == bound) return@LaunchedEffect
        kotlinx.coroutines.delay(debounceMs.toLong().coerceIn(0, 5_000))
        controller.setStateValue(bindTo, SpValue.Str(text))
        controller.dispatch(onChange)
    }

    val keyboard = node.token("keyboard", "text")
    val isPassword = keyboard == "password"
    val errorText = node.stringOrNull("errorText")

    OutlinedTextField(
        value = text,
        onValueChange = { next ->
            val maxLength = node.intOrNull("maxLength")
            text = if (maxLength != null && next.length > maxLength) next.take(maxLength) else next
            if (onChange.isEmpty()) controller.setStateValue(bindTo, SpValue.Str(text))
        },
        modifier = modifier.spectreNode(node).fillMaxWidth(),
        label = node.stringOrNull("label")?.let { { Text(it) } },
        placeholder = node.stringOrNull("placeholder")?.let { { Text(it) } },
        supportingText = (errorText ?: node.stringOrNull("helperText"))?.let { { Text(it) } },
        isError = errorText != null,
        singleLine = !node.bool("multiline", false),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = when (keyboard) {
                "email" -> KeyboardType.Email
                "number" -> KeyboardType.Number
                "phone" -> KeyboardType.Phone
                "url" -> KeyboardType.Uri
                "password" -> KeyboardType.Password
                else -> KeyboardType.Text
            },
            imeAction = if (node.actions("onSubmit").isNotEmpty()) ImeAction.Done else ImeAction.Default,
        ),
        keyboardActions = KeyboardActions(
            onDone = {
                controller.setStateValue(bindTo, SpValue.Str(text))
                controller.dispatch(node.actions("onSubmit"))
            }
        ),
    )
}

@Composable
fun ToggleView(node: RenderNode, modifier: Modifier) {
    val controller = LocalSpectreController.current
    val bindTo = node.stringOrNull("bindTo") ?: return
    val checked = controller.stateValue(bindTo).isTruthy

    Row(
        modifier = modifier.spectreNode(node).fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        node.stringOrNull("label")?.let { Text(it) }
        Switch(
            checked = checked,
            onCheckedChange = {
                controller.setStateValue(bindTo, SpValue.Bool(it))
                controller.dispatch(node.actions("onChange"))
            },
            enabled = node.bool("enabled", true),
        )
    }
}

@Composable
fun CheckboxView(node: RenderNode, modifier: Modifier) {
    val controller = LocalSpectreController.current
    val bindTo = node.stringOrNull("bindTo") ?: return
    val checked = controller.stateValue(bindTo).isTruthy
    val enabled = node.bool("enabled", true)

    val toggle = {
        controller.setStateValue(bindTo, SpValue.Bool(!checked))
        controller.dispatch(node.actions("onChange"))
    }

    Row(
        modifier = modifier.spectreNode(node),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, onCheckedChange = { toggle() }, enabled = enabled)
        node.stringOrNull("label")?.let {
            Text(it, modifier = Modifier.padding(start = 4.dp))
        }
    }
}

@Composable
fun RadioGroupView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val controller = LocalSpectreController.current
    val bindTo = node.stringOrNull("bindTo") ?: return
    val selected = controller.stateValue(bindTo).let { if (it is SpValue.Null) null else it.stringify() }
    val opts = node.options("options")

    val select: (SpectreOption) -> Unit = { option ->
        controller.setStateValue(bindTo, SpValue.Str(option.value))
        controller.dispatch(node.actions("onChange"))
    }

    val item: @Composable (SpectreOption) -> Unit = { option ->
        Row(
            modifier = Modifier
                .selectable(
                    selected = option.value == selected,
                    enabled = option.enabled,
                    onClick = { select(option) },
                ),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(
                selected = option.value == selected,
                onClick = { select(option) },
                enabled = option.enabled,
            )
            Text(option.label)
        }
    }

    if (node.token("orientation", "vertical") == "horizontal") {
        Row(
            modifier = modifier.spectreNode(node),
            horizontalArrangement = Arrangement.spacedBy(theme.space("sm")),
        ) { opts.forEach { item(it) } }
    } else {
        Column(modifier = modifier.spectreNode(node)) { opts.forEach { item(it) } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectView(node: RenderNode, modifier: Modifier) {
    val controller = LocalSpectreController.current
    val bindTo = node.stringOrNull("bindTo") ?: return
    val opts = node.options("options")
    val selected = controller.stateValue(bindTo).let { if (it is SpValue.Null) null else it.stringify() }
    val selectedLabel = opts.firstOrNull { it.value == selected }?.label
        ?: node.stringOrNull("placeholder")
        ?: ""

    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier.spectreNode(node),
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            label = node.stringOrNull("label")?.let { { Text(it) } },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor(androidx.compose.material3.MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            opts.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.label) },
                    enabled = option.enabled,
                    onClick = {
                        expanded = false
                        controller.setStateValue(bindTo, SpValue.Str(option.value))
                        controller.dispatch(node.actions("onChange"))
                    },
                )
            }
        }
    }
}

@Composable
fun SliderView(node: RenderNode, modifier: Modifier) {
    val controller = LocalSpectreController.current
    val bindTo = node.stringOrNull("bindTo") ?: return
    val min = node.float("min", 0f)
    val max = node.float("max", 100f)
    val step = node.float("step", 1f)
    val current = controller.stateValue(bindTo).asDoubleOrNull?.toFloat() ?: min

    // Compose の steps は「両端を除いた刻みの数」
    val steps = if (step > 0f && max > min) (((max - min) / step).toInt() - 1).coerceAtLeast(0) else 0

    Column(modifier.spectreNode(node)) {
        if (node.bool("showValue", false)) Text(current.toInt().toString())
        Slider(
            value = current.coerceIn(min, max),
            onValueChange = { controller.setStateValue(bindTo, SpValue.Num(it.toDouble())) },
            onValueChangeFinished = { controller.dispatch(node.actions("onChange")) },
            valueRange = min..max,
            steps = steps,
        )
    }
}

@Composable
fun StepperView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val controller = LocalSpectreController.current
    val bindTo = node.stringOrNull("bindTo") ?: return
    val step = node.float("step", 1f)
    val min = node.floatOrNull("min") ?: 0f
    val max = node.floatOrNull("max")
    val current = controller.stateValue(bindTo).asDoubleOrNull?.toFloat() ?: min

    val apply: (Float) -> Unit = { next ->
        val clamped = if (max != null) next.coerceIn(min, max) else next.coerceAtLeast(min)
        if (clamped != current) {
            controller.setStateValue(bindTo, SpValue.Num(clamped.toDouble()))
            controller.dispatch(node.actions("onChange"))
        }
    }

    Row(
        modifier = modifier.spectreNode(node),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(theme.space("xs")),
    ) {
        // マイナスは Material のコアアイコン集合にないため文字で描く
        TextButton(
            onClick = { apply(current - step) },
            enabled = current > min,
        ) { Text("−") }

        Text(
            text = current.toInt().toString(),
            style = MaterialTheme.typography.titleMedium,
        )

        TextButton(
            onClick = { apply(current + step) },
            enabled = max == null || current < max,
        ) { Text("+") }
    }
}

/**
 * 日付入力。
 *
 * v0.1 ではカレンダーダイアログを出さず、ISO 8601 文字列の直接入力にしている。
 * Material3 の DatePickerDialog は実験的 API で、SwiftUI 側の DatePicker と
 * 挙動を揃えるのに追加の設計が要るため、先に他を固めてから取り組む。
 */
@Composable
fun DatePickerView(node: RenderNode, modifier: Modifier) {
    val controller = LocalSpectreController.current
    val bindTo = node.stringOrNull("bindTo") ?: return
    val value = controller.stateValue(bindTo).let { if (it is SpValue.Null) "" else it.stringify() }

    OutlinedTextField(
        value = value,
        onValueChange = {
            controller.setStateValue(bindTo, SpValue.Str(it))
            controller.dispatch(node.actions("onChange"))
        },
        modifier = modifier.spectreNode(node).fillMaxWidth(),
        label = node.stringOrNull("label")?.let { { Text(it) } },
        placeholder = { Text("YYYY-MM-DD") },
        singleLine = true,
    )
}
