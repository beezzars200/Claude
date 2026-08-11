import SwiftUI

@main
struct StudioMessengerApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .frame(minWidth: 820, minHeight: 560)
                .background(appState.theme.bgPrimary)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .appInfo) {
                Button("Refresh Messages") {
                    appState.refresh()
                }
                .keyboardShortcut("r")
            }
        }

        Settings {
            SettingsView()
                .environmentObject(appState)
        }
    }
}
