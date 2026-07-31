import Foundation

/// アクション列の逐次実行。
///
/// 意図的にチューリング完全にしていない — ループがなく、ネストと総数に上限があるため、
/// 1回のディスパッチは必ず有限で終わる。無限ループするドキュメントは作れない
/// (docs/spec/actions.md §5)。
public final class ActionDispatcher {
    private weak var host: SpectreHostDelegate?
    private let templates: TemplateEvaluator
    private let maxActions: Int
    private let maxNesting: Int

    public init(
        host: SpectreHostDelegate,
        templates: TemplateEvaluator = TemplateEvaluator(),
        maxActions: Int = SpectreLimits.maxActionsPerDispatch,
        maxNesting: Int = SpectreLimits.maxActionNesting
    ) {
        self.host = host
        self.templates = templates
        self.maxActions = maxActions
        self.maxNesting = maxNesting
    }

    public struct DispatchResult: Sendable {
        public let effects: [SpValue]
        public let aborted: Bool

        /// UI 層が処理する副作用だけを取り出す。
        public var uiEffects: [SpectreUIEffect] { effects.compactMap(ActionDispatcher.toUIEffect) }
    }

    /// - Parameter locals: repeat の内側から発火した場合の `item` / `index`。
    public func dispatch(
        _ actions: [SpValue],
        store: Store,
        locals: [String: SpValue] = [:]
    ) async -> DispatchResult {
        let run = Run(
            store: store,
            locals: locals,
            host: host,
            templates: templates,
            maxActions: maxActions,
            maxNesting: maxNesting
        )
        await run.execute(actions, depth: 0)
        return DispatchResult(effects: run.effects, aborted: run.aborted)
    }

    private final class Run {
        let store: Store
        let locals: [String: SpValue]
        weak var host: SpectreHostDelegate?
        let templates: TemplateEvaluator
        let maxActions: Int
        let maxNesting: Int

        var effects: [SpValue] = []
        var aborted = false
        private var executed = 0
        private var errorScope: SpValue?

        init(
            store: Store,
            locals: [String: SpValue],
            host: SpectreHostDelegate?,
            templates: TemplateEvaluator,
            maxActions: Int,
            maxNesting: Int
        ) {
            self.store = store
            self.locals = locals
            self.host = host
            self.templates = templates
            self.maxActions = maxActions
            self.maxNesting = maxNesting
        }

        var scope: EvalScope {
            var extra = locals
            if let errorScope { extra["error"] = errorScope }
            return store.scope(locals: extra)
        }

        func execute(_ actions: [SpValue], depth: Int) async {
            if depth > maxNesting {
                emit("limitExceeded", ["limit": .string("maxActionNesting")])
                aborted = true
                return
            }
            for action in actions {
                if aborted { return }
                if executed >= maxActions {
                    emit("limitExceeded", ["limit": .string("maxActionsPerDispatch")])
                    aborted = true
                    return
                }
                executed += 1
                guard action.asObject != nil else { continue }
                await perform(action, depth: depth)
            }
        }

        private func perform(_ action: SpValue, depth: Int) async {
            guard let type = action["type"]?.asString else { return }
            let continueOnError = action["continueOnError"]?.asBool ?? false

            // ホストアプリに割り込みの機会を与える。
            if let host, !host.shouldPerform(action) {
                aborted = true
                return
            }

            var failed = false

            switch type {
            case "setState":
                applySetState(action)
            case "toggleState":
                applyToggleState(action)
            case "sequence":
                await execute(action["actions"]?.asArray ?? [], depth: depth + 1)
            case "condition":
                await applyCondition(action, depth: depth)
            case "delay":
                let ms = min(max(action["ms"]?.asInt ?? 0, 0), 10_000)
                try? await Task.sleep(nanoseconds: UInt64(ms) * 1_000_000)
            case "request":
                failed = await performRequest(action, depth: depth)
            case "navigate":
                performNavigate(action)
            case "openUrl":
                performOpenURL(action)
            case "track":
                performTrack(action)
            case "host":
                failed = await performHostAction(action, depth: depth)
            case "showOverlay":
                emit("showOverlay", ["id": action["id"] ?? .null])
            case "dismissOverlay":
                emit("dismissOverlay", ["id": action["id"] ?? .null])
            case "back":
                emit("back", [:])
            case "dismiss":
                emit("dismiss", [:])
            case "refresh":
                emit("refresh", ["preserveState": .bool(action["preserveState"]?.asBool ?? false)])
            case "applyPatch":
                emit("applyPatch", ["patch": action["patch"] ?? .array([])])
            case "focus":
                emit("focus", ["nodeId": action["nodeId"] ?? .null])
            case "scrollTo":
                emit("scrollTo", [
                    "nodeId": action["nodeId"] ?? .null,
                    "animated": .bool(action["animated"]?.asBool ?? true),
                ])
            default:
                await performUnknown(action, type: type, depth: depth)
            }

            if failed && !continueOnError { aborted = true }
        }

        // MARK: 個別のアクション

        private func applySetState(_ action: SpValue) {
            if let patch = action["patch"]?.asObject {
                store.setStates(patch.mapValues { resolve($0) })
                return
            }
            guard let path = action["path"]?.asString else { return }
            store.setState(path, resolve(action["value"] ?? .null))
        }

        private func applyToggleState(_ action: SpValue) {
            guard let path = action["path"]?.asString else { return }
            store.setState(path, .bool(!store.state.path(path).isTruthy))
        }

        private func applyCondition(_ action: SpValue, depth: Int) async {
            guard let condition = action["if"]?.asString else { return }
            let branch = templates.evaluate(condition, scope: scope).value.isTruthy ? "then" : "else"
            await execute(action[branch]?.asArray ?? [], depth: depth + 1)
        }

        /// - Returns: 失敗したら true
        private func performRequest(_ action: SpValue, depth: Int) async -> Bool {
            guard let endpoint = action["endpoint"]?.asString else { return true }
            let method = action["method"]?.asString ?? "GET"
            let loadingPath = action["loadingPath"]?.asString

            let body = resolve(action["body"] ?? .null)
            let pathParams = resolveMap(action["pathParams"])
            let query = resolveMap(action["query"])

            if let loadingPath { store.setState(loadingPath, .bool(true)) }

            emit("request", [
                "endpoint": .string(endpoint),
                "method": .string(method),
                "body": body,
            ])

            let request = SpectreRequest(
                endpoint: endpoint,
                method: method,
                pathParams: pathParams,
                query: query,
                body: body,
                timeoutMs: action["timeoutMs"]?.asInt ?? 10_000,
                idempotencyKey: action["idempotencyKey"]?.asString.map {
                    resolve(.string($0)).stringify()
                }
            )

            var response: SpectreActionResponse
            if let host {
                do {
                    response = try await host.performRequest(request)
                } catch {
                    response = .failure(code: "NETWORK_ERROR", message: error.localizedDescription)
                }
            } else {
                response = .failure(code: "NO_HOST", message: "ホストが設定されていません")
            }

            // 適用順は screen -> data -> state -> patch -> actions (docs/spec/actions.md §3)
            if let screen = response.screen { emit("replaceScreen", ["document": screen]) }
            if let data = response.data { store.mergeData(data) }
            if let state = response.state { store.mergeState(state) }
            if !response.patch.isEmpty { emit("applyPatch", ["patch": .array(response.patch)]) }

            if let loadingPath { store.setState(loadingPath, .bool(false)) }

            if response.ok {
                await execute(response.actions, depth: depth + 1)
                await execute(action["onSuccess"]?.asArray ?? [], depth: depth + 1)
                return false
            } else {
                let previous = errorScope
                errorScope = (response.error ?? SpectreErrorPayload(code: "UNKNOWN", message: "")).toScopeValue()
                await execute(action["onError"]?.asArray ?? [], depth: depth + 1)
                errorScope = previous
                return true
            }
        }

        private func performNavigate(_ action: SpValue) {
            let mode = action["mode"]?.asString ?? "push"
            let screen = action["screen"]?.asString
            let route = action["route"]?.asString.map { resolve(.string($0)).stringify() }
            let params = resolveMap(action["params"])

            var payload: [String: SpValue] = ["mode": .string(mode)]
            if let screen { payload["screen"] = .string(screen) }
            if let route { payload["route"] = .string(route) }
            if !params.isEmpty { payload["params"] = .object(params) }
            emit("navigate", payload)

            _ = host?.navigate(
                to: SpectreDestination(mode: mode, screen: screen, route: route, params: params)
            )
        }

        private func performOpenURL(_ action: SpValue) {
            let url = resolve(action["url"] ?? .null).stringify()
            let mode = action["mode"]?.asString ?? "inApp"
            emit("openUrl", ["url": .string(url), "mode": .string(mode)])
            _ = host?.openURL(url, mode: mode)
        }

        private func performTrack(_ action: SpValue) {
            guard let event = action["event"]?.asString else { return }
            let properties = SpValue.object(resolveMap(action["properties"]))
            emit("track", ["event": .string(event), "properties": properties])
            host?.track(event: event, properties: properties)
        }

        private func performHostAction(_ action: SpValue, depth: Int) async -> Bool {
            guard let name = action["name"]?.asString else { return true }
            let params = SpValue.object(resolveMap(action["params"]))
            emit("host", ["name": .string(name), "params": params])

            do {
                let result = try await host?.performHostAction(name: name, params: params)
                if let resultPath = action["resultPath"]?.asString {
                    store.setState(resultPath, result ?? .null)
                }
                await execute(action["onSuccess"]?.asArray ?? [], depth: depth + 1)
                return false
            } catch {
                let previous = errorScope
                errorScope = SpectreErrorPayload(
                    code: "HOST_ACTION_FAILED",
                    message: error.localizedDescription
                ).toScopeValue()
                await execute(action["onError"]?.asArray ?? [], depth: depth + 1)
                errorScope = previous
                return true
            }
        }

        /// 未知のアクション種別。
        ///
        /// 黙って飛ばすのは前方互換性のため — 新しいアクションを追加しても
        /// 古いクライアントが壊れない。飛ばすと困るものには `required: true` を
        /// 付けて `fallbackActions` を用意する (docs/spec/actions.md §4)。
        private func performUnknown(_ action: SpValue, type: String, depth: Int) async {
            emit("unknownAction", ["name": .string(type)])
            if action["required"]?.asBool == true {
                await execute(action["fallbackActions"]?.asArray ?? [], depth: depth + 1)
            }
        }

        // MARK: ヘルパ

        /// アクション内の値を、その時点の state で解決する。
        private func resolve(_ value: SpValue) -> SpValue {
            switch value {
            case .string(let text):
                return templates.evaluate(text, scope: scope).value
            case .array(let items):
                return .array(items.map { resolve($0) })
            case .object(let entries):
                return .object(entries.mapValues { resolve($0) })
            default:
                return value
            }
        }

        private func resolveMap(_ value: SpValue?) -> [String: SpValue] {
            (value?.asObject ?? [:]).mapValues { resolve($0) }
        }

        private func emit(_ type: String, _ entries: [String: SpValue]) {
            var payload = entries
            payload["type"] = .string(type)
            effects.append(.object(payload))
        }
    }

    private static func toUIEffect(_ effect: SpValue) -> SpectreUIEffect? {
        guard let type = effect["type"]?.asString else { return nil }
        let id = effect["id"]?.asString
        let nodeID = effect["nodeId"]?.asString
        switch type {
        case "showOverlay": return id.map { .showOverlay($0) }
        case "dismissOverlay": return .dismissOverlay(id)
        case "back": return .back
        case "dismiss": return .dismiss
        case "refresh": return .refresh(preserveState: effect["preserveState"]?.asBool ?? false)
        case "focus": return nodeID.map { .focus($0) }
        case "scrollTo":
            return nodeID.map { .scrollTo(nodeID: $0, animated: effect["animated"]?.asBool ?? true) }
        case "replaceScreen": return effect["document"].map { .replaceScreen($0) }
        case "applyPatch": return .applyPatch(effect["patch"]?.asArray ?? [])
        default: return nil
        }
    }
}
