**English** · [日本語](demo-ja.md)

# Try it: four demos

`scripts/demo.sh` starts one of four running demos of Spectre UI. All four render the same sample
screen, through a different part of the system each time. The screen is
[`examples/screens/product-detail.json`](../examples/screens/product-detail.json). Run a demo as
`./scripts/demo.sh <target>` from the repository root. Its script also runs directly under
`scripts/demo/`.

```sh
./scripts/demo.sh editor    # the WYSIWYG editor — start here
./scripts/demo.sh server    # the authoring and delivery API
./scripts/demo.sh ios       # the iOS sample app
./scripts/demo.sh android   # the Android sample app
```

Each script checks its own prerequisites first. When one is missing, it names the missing tool or
service and stops. None of them fails partway through.

## 1. The editor — `./scripts/demo.sh editor`

**Needs:** Node.js 22 or newer, and [pnpm](https://pnpm.io/installation). Nothing else. No
database, no native toolchain.

The script installs dependencies on first run. It then starts the editor's Vite dev server at
`http://localhost:5173`. The sample screen is already loaded.

This is the fastest way to see Spectre UI's central premise. The palette, the canvas, and the
inspector all read [the component manifest](../spec/component-manifest.json) at runtime. They
build themselves from it. Nothing here is hand-coded per component.

Once the editor is open, try:

- Drag a component from the palette onto the canvas. Select it to edit its properties in the
  inspector.
- Open the **Data** tab at the bottom and edit the sample data. The canvas updates the bound
  fields (price, stock, and the rest) live.
- Open the **アクションカタログ** (action catalog) tab to see the action editor, described in
  [`docs/editor.md`](editor.md) §4.
- Press Ctrl/Cmd+Z to undo an edit, and Ctrl/Cmd+Shift+Z to redo it.

`packages/editor/src/App.tsx` documents this wiring in full. See
[`docs/editor.md`](editor.md) for the editor's complete design.

## 2. The server — `./scripts/demo.sh server`

**Needs:** Node.js and pnpm, plus a PostgreSQL instance.

The script checks port 5432 for an existing PostgreSQL instance. If none answers, it starts a
throwaway `postgres:16` container through Docker. The script deletes that container again on
exit.

Suppose PostgreSQL already runs locally instead, as in a developer's own setup. Then the script
reuses it, and never touches Docker.

This demo drives the authoring and delivery API ([`packages/server`](../packages/server), SU-0004).
It follows the same four-step loop an author's publish button drives. It prints each request and
each response as it runs:

1. **Create a draft** — `POST /api/documents`, with the sample screen's body as its first version.
2. **Validate it** — `POST /api/documents/:id/validate`, against the component manifest.
3. **Publish it** — `POST /api/documents/:id/publish`, to the `internal` channel. (`production`
   needs a second approver by default; `internal` keeps this demo to one command.)
4. **Fetch it back** — `GET /screens/:screenId`, the same request a client SDK makes. It returns
   the published document with an `ETag` for conditional requests.

The server keeps running afterward. The script prints more `curl` commands to try: fetching the
document again, or reading its audit log.

Stop the server with Ctrl+C. Doing so also tears down the Docker container, if the script started
one.

See [`docs/architecture.md`](architecture.md) §4 for the authoring and delivery API's full design.
[`docs/compatibility.md`](compatibility.md) explains the `ETag` and the capability headers on the
delivery response.

## 3. The iOS sample app — `./scripts/demo.sh ios`

**Needs:** macOS, Xcode, and [XcodeGen](https://github.com/yonaskolb/XcodeGen)
(`brew install xcodegen`).

Generates `clients/ios/SampleApp`'s Xcode project and opens it. The project itself is not
committed; `project.yml` is the source of truth XcodeGen reads. Press Run (⌘R) once Xcode finishes
indexing. The sample screen renders with SwiftUI, through `SpectreUI`, the Swift runtime under
[`clients/ios`](../clients/ios).

A second sample app renders a screen delivered by Apple Push Notification service (APNs). It does
not bundle the screen with the app. From `clients/ios/APNsSample`, run `xcodegen generate && open
SpectreAPNsSample.xcodeproj` for that one.
[SU-0012](../roadmaps/SU-0012-apns-sdui-sample-app/SU-0012-apns-sdui-sample-app.md) records its
design.

## 4. The Android sample app — `./scripts/demo.sh android`

**Needs:** the Android SDK, and a connected device or a running emulator. Android Studio sets
`ANDROID_HOME` or `ANDROID_SDK_ROOT` for the SDK by default.

Builds and installs the sample app's debug build (`./gradlew :sample:installDebug`). Once it
finishes, open "Spectre Sample" from the device's app drawer. The sample screen renders there with
Jetpack Compose. The renderer is `spectre-ui`, the Kotlin runtime under
[`clients/android`](../clients/android).

## Troubleshooting

- **"No device or emulator is connected" (Android)**. Start an emulator from Android Studio's
  Device Manager. Or connect a physical device with USB debugging enabled. Rerun the script.
- **"Docker is installed but not running" (server)**. Start Docker Desktop, or the `docker` daemon
  on Linux, then rerun the script. Suppose PostgreSQL already runs elsewhere instead. Then set
  `DATABASE_URL` before running the script, for example
  `DATABASE_URL=postgres://user:pass@db-host:5432/db ./scripts/demo.sh server`. The script reuses
  a database it can already reach, and turns to Docker in every other case.
- **Port 3000 or 5173 is already in use**. Stop whatever is using it, or set a different port
  first: `PORT=3001 ./scripts/demo.sh server`. The editor's port is Vite's own `--port` flag.
  Pass it after `--` to `pnpm --filter @spectre-ui/editor run dev`.
- **A demo script stops with a specific instruction** (install a tool, start a service). That
  instruction is the fix. Each script checks its prerequisites first. A missing tool never turns
  up as a puzzling error partway through a run.

The demos above do not cover everything. Two examples are running the test suites, and checking
generated code against the manifest. Continuous integration (CI) runs that remaining set of
checks on every pull request. See
["Running it" in the top-level README](../README.md#running-it) for those commands.
