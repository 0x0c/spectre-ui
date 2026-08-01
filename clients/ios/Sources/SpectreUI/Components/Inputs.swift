import SwiftUI
import SpectreCore

struct ButtonView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let label = node.string("label")
        let loading = node.bool("loading", default: false)
        // loading 中はタップを無効化する。多重発火の防止は ActionDispatcher 側でも
        // 行うが、押せてしまうこと自体が誤操作の原因になるので UI でも止める。
        let enabled = node.bool("enabled", default: true) && !loading
        let variant = node.token("variant", default: "primary")

        Button {
            model.dispatch(node.actions("onTap"))
        } label: {
            HStack(spacing: theme.space("xs")) {
                if loading {
                    ProgressView().controlSize(.small)
                } else if let icon = node.tokenOrNil("leadingIcon") {
                    Image(systemName: theme.symbol(icon))
                }
                if !label.isEmpty { Text(label) }
                if let icon = node.tokenOrNil("trailingIcon") {
                    Image(systemName: theme.symbol(icon))
                }
            }
            .frame(maxWidth: node.layout["width"]?.asString == "fill" ? .infinity : nil)
        }
        .disabled(!enabled)
        .modifier(ButtonVariantModifier(variant: variant, size: node.token("size", default: "md")))
        .spectreNode(node)
    }
}

private struct ButtonVariantModifier: ViewModifier {
    let variant: String
    let size: String

    func body(content: Content) -> some View {
        let controlSize: ControlSize = size == "sm" ? .small : (size == "lg" ? .large : .regular)
        switch variant {
        case "secondary":
            return AnyView(content.buttonStyle(.bordered).controlSize(controlSize))
        case "tertiary", "text":
            return AnyView(content.buttonStyle(.borderless).controlSize(controlSize))
        case "destructive":
            return AnyView(content.buttonStyle(.borderedProminent).tint(.red).controlSize(controlSize))
        default:
            return AnyView(content.buttonStyle(.borderedProminent).controlSize(controlSize))
        }
    }
}

struct TextFieldView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme
    @State private var text: String = ""
    @State private var debounceTask: Task<Void, Never>?
    /// `focus` アクション (docs/spec/actions.md) の着地点。
    @FocusState private var isFocused: Bool

    var body: some View {
        let bindTo = node.stringOrNil("bindTo")
        let bound = bindTo.map { model.stateValue($0) } ?? .null
        let boundText = bound.isNull ? "" : bound.stringify()
        let errorText = node.stringOrNil("errorText")
        let keyboard = node.token("keyboard", default: "text")

        VStack(alignment: .leading, spacing: 4) {
            if let label = node.stringOrNil("label") {
                Text(label).font(theme.font("caption")).foregroundStyle(.secondary)
            }

            Group {
                if keyboard == "password" {
                    SecureField(node.stringOrNil("placeholder") ?? "", text: $text)
                } else if node.bool("multiline", default: false) {
                    TextField(node.stringOrNil("placeholder") ?? "", text: $text, axis: .vertical)
                        .lineLimit(3...6)
                } else {
                    TextField(node.stringOrNil("placeholder") ?? "", text: $text)
                }
            }
            .textFieldStyle(.roundedBorder)
            .autocorrectionDisabled(keyboard == "email" || keyboard == "url")
            // キーボード種別と自動大文字化は UIKit 由来で macOS には無い。
            // CI が macOS ホストで `swift build` を通せるよう分岐しておく。
            .modifier(KeyboardTraitsModifier(keyboard: keyboard))
            .focused($isFocused)
            .onSubmit {
                if let bindTo { model.setStateValue(bindTo, .string(text)) }
                model.dispatch(node.actions("onSubmit"))
            }

            if let supporting = errorText ?? node.stringOrNil("helperText") {
                Text(supporting)
                    .font(theme.font("caption"))
                    .foregroundStyle(errorText != nil ? theme.color("error", default: .red) : .secondary)
            }
        }
        // 入力中は自前の状態で追従し、確定後に state へ反映する。
        // state 経由で毎打鍵を往復させるとカーソル位置が飛ぶため。
        .onAppear { text = boundText }
        .onChange(of: boundText) { newValue in
            if newValue != text { text = newValue }
        }
        .onChange(of: model.focusRequest) { newValue in
            guard let nodeID = node.nodeID, newValue == nodeID else { return }
            isFocused = true
            model.consumeFocusRequest()
        }
        .onChange(of: text) { newValue in
            guard let bindTo, newValue != boundText else { return }
            let maxLength = node.intOrNil("maxLength")
            let clipped = maxLength.map { String(newValue.prefix($0)) } ?? newValue
            if clipped != newValue { text = clipped; return }

            let onChange = node.actions("onChange")
            guard !onChange.isEmpty else {
                model.setStateValue(bindTo, .string(clipped))
                return
            }
            // onChange はデバウンス後に発火する。1文字ごとにサーバへ飛ばさないための既定値。
            debounceTask?.cancel()
            let delayMs = node.int("debounceMs", default: 300)
            debounceTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(min(max(delayMs, 0), 5000)) * 1_000_000)
                guard !Task.isCancelled else { return }
                model.setStateValue(bindTo, .string(clipped))
                model.dispatch(onChange)
            }
        }
        .spectreNode(node)
    }
}

/// キーボード種別と自動大文字化の指定。
///
/// どちらも UIKit 由来で macOS には存在しないため、iOS 以外では何もしない。
/// SpectreCore の適合性テストを macOS ホストで走らせる都合上、
/// SpectreUI も macOS でコンパイルが通る必要がある。
private struct KeyboardTraitsModifier: ViewModifier {
    let keyboard: String

    func body(content: Content) -> some View {
        #if os(iOS)
        content
            .keyboardType(keyboardType)
            .textInputAutocapitalization(keyboard == "email" || keyboard == "url" ? .never : .sentences)
        #else
        content
        #endif
    }

    #if os(iOS)
    private var keyboardType: UIKeyboardType {
        switch keyboard {
        case "email": return .emailAddress
        case "number": return .numberPad
        case "phone": return .phonePad
        case "url": return .URL
        default: return .default
        }
    }
    #endif
}

struct ToggleView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel

    var body: some View {
        if let bindTo = node.stringOrNil("bindTo") {
            Toggle(node.stringOrNil("label") ?? "", isOn: Binding(
                get: { model.stateValue(bindTo).isTruthy },
                set: { newValue in
                    model.setStateValue(bindTo, .bool(newValue))
                    model.dispatch(node.actions("onChange"))
                }
            ))
            .disabled(!node.bool("enabled", default: true))
            .spectreNode(node)
        }
    }
}

/// SwiftUI に Checkbox はないため、トグル可能な行として表現する。
/// iOS の慣習に合わせつつ、Android の Checkbox と同じ操作結果になるようにしている。
struct CheckboxView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        if let bindTo = node.stringOrNil("bindTo") {
            let checked = model.stateValue(bindTo).isTruthy
            Button {
                model.setStateValue(bindTo, .bool(!checked))
                model.dispatch(node.actions("onChange"))
            } label: {
                HStack(spacing: theme.space("sm")) {
                    Image(systemName: checked ? "checkmark.square.fill" : "square")
                        .foregroundStyle(checked ? theme.color("primary", default: .accentColor) : .secondary)
                    if let label = node.stringOrNil("label") {
                        Text(label).foregroundStyle(.primary)
                    }
                    Spacer(minLength: 0)
                }
            }
            .buttonStyle(.plain)
            .disabled(!node.bool("enabled", default: true))
            .accessibilityAddTraits(checked ? [.isButton, .isSelected] : .isButton)
            .spectreNode(node)
        }
    }
}

struct RadioGroupView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        if let bindTo = node.stringOrNil("bindTo") {
            let selected = model.stateValue(bindTo).stringify()
            let options = node.options("options")
            let horizontal = node.token("orientation", default: "vertical") == "horizontal"

            Group {
                if horizontal {
                    HStack(spacing: theme.space("sm")) {
                        ForEach(options) { option in row(option, selected: selected, bindTo: bindTo) }
                    }
                } else {
                    VStack(alignment: .leading, spacing: theme.space("xs")) {
                        ForEach(options) { option in row(option, selected: selected, bindTo: bindTo) }
                    }
                }
            }
            .spectreNode(node)
        }
    }

    @ViewBuilder
    private func row(_ option: SpectreOption, selected: String, bindTo: String) -> some View {
        let isSelected = option.value == selected
        Button {
            model.setStateValue(bindTo, .string(option.value))
            model.dispatch(node.actions("onChange"))
        } label: {
            HStack(spacing: 6) {
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(isSelected ? theme.color("primary", default: .accentColor) : .secondary)
                Text(option.label).foregroundStyle(.primary)
            }
        }
        .buttonStyle(.plain)
        .disabled(!option.enabled)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

struct SelectView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel

    var body: some View {
        if let bindTo = node.stringOrNil("bindTo") {
            let options = node.options("options")
            let selected = model.stateValue(bindTo).stringify()

            Picker(node.stringOrNil("label") ?? "", selection: Binding(
                get: { selected },
                set: { newValue in
                    model.setStateValue(bindTo, .string(newValue))
                    model.dispatch(node.actions("onChange"))
                }
            )) {
                if !options.contains(where: { $0.value == selected }) {
                    Text(node.stringOrNil("placeholder") ?? "選択してください").tag(selected)
                }
                ForEach(options) { option in
                    Text(option.label).tag(option.value)
                }
            }
            // searchable が真ならシート表示に切り替える想定だが、v0.1 はメニューのみ。
            .pickerStyle(.menu)
            .spectreNode(node)
        }
    }
}

struct SliderView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel

    var body: some View {
        if let bindTo = node.stringOrNil("bindTo") {
            let minValue = node.double("min", default: 0)
            let maxValue = node.double("max", default: 100)
            let step = node.double("step", default: 1)
            let current = model.stateValue(bindTo).asDouble ?? minValue

            VStack(alignment: .leading, spacing: 4) {
                if node.bool("showValue", default: false) {
                    Text(SpValue.formatNumberPlain(current))
                }
                Slider(
                    value: Binding(
                        get: { min(max(current, minValue), maxValue) },
                        set: { model.setStateValue(bindTo, .number($0)) }
                    ),
                    in: minValue...max(maxValue, minValue + 1),
                    step: step > 0 ? step : 1,
                    onEditingChanged: { editing in
                        if !editing { model.dispatch(node.actions("onChange")) }
                    }
                )
            }
            .spectreNode(node)
        }
    }
}

struct StepperView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel

    var body: some View {
        if let bindTo = node.stringOrNil("bindTo") {
            let step = node.double("step", default: 1)
            let minValue = node.doubleOrNil("min") ?? 0
            let maxValue = node.doubleOrNil("max")
            let current = model.stateValue(bindTo).asDouble ?? minValue

            Stepper {
                Text(SpValue.formatNumberPlain(current))
            } onIncrement: {
                let next = current + step
                guard maxValue == nil || next <= maxValue! else { return }
                model.setStateValue(bindTo, .number(next))
                model.dispatch(node.actions("onChange"))
            } onDecrement: {
                let next = current - step
                guard next >= minValue else { return }
                model.setStateValue(bindTo, .number(next))
                model.dispatch(node.actions("onChange"))
            }
            .spectreNode(node)
        }
    }
}

struct DatePickerView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel

    /// IconView と同じ理由で body の外に出す。@ViewBuilder の下では
    /// 代入の switch が View 式として解釈される。
    private var components: DatePickerComponents {
        switch node.token("mode", default: "date") {
        case "time": return [.hourAndMinute]
        case "dateTime": return [.date, .hourAndMinute]
        default: return [.date]
        }
    }

    var body: some View {
        if let bindTo = node.stringOrNil("bindTo") {
            let raw = model.stateValue(bindTo).stringify()
            DatePicker(
                node.stringOrNil("label") ?? "",
                selection: Binding(
                    get: { SpectreDate.parse(raw) ?? Date() },
                    set: { newDate in
                        model.setStateValue(bindTo, .string(SpectreDate.format(newDate)))
                        model.dispatch(node.actions("onChange"))
                    }
                ),
                displayedComponents: components
            )
            .spectreNode(node)
        }
    }
}

/// ドキュメント側の日付表現は常に ISO 8601 文字列。
/// Android 側も同じ文字列を state に置くため、サーバから見て差が出ない。
enum SpectreDate {
    private static let formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ text: String) -> Date? {
        guard !text.isEmpty else { return nil }
        if let date = formatter.date(from: text) { return date }
        // "2026-03-05" のような日付のみの表記も受ける
        let dateOnly = DateFormatter()
        dateOnly.calendar = Calendar(identifier: .gregorian)
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.timeZone = TimeZone(identifier: "UTC")
        dateOnly.dateFormat = "yyyy-MM-dd"
        return dateOnly.date(from: text)
    }

    static func format(_ date: Date) -> String { formatter.string(from: date) }
}
