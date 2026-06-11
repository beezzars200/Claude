import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Settings")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(appState.theme.textPrimary)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(appState.theme.textDim)
                }
                .buttonStyle(.plain)
            }
            .padding(20)
            .background(appState.theme.bgSecondary)

            Divider().background(appState.theme.borderColor)

            // Body
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {

                    // Theme section
                    settingsSection(title: "Station Theme") {
                        HStack(spacing: 12) {
                            ForEach(StationTheme.allCases) { t in
                                ThemeCard(theme: t, isSelected: appState.theme == t) {
                                    appState.setTheme(t)
                                }
                            }
                        }
                    }

                    // Data section
                    settingsSection(title: "Live Data") {
                        VStack(alignment: .leading, spacing: 8) {
                            infoRow(icon: "arrow.clockwise", label: "Refresh interval", value: "5 seconds")
                            infoRow(icon: "globe", label: "Source", value: "unitymedianetwork.com")
                            infoRow(icon: "tray.fill", label: "Messages loaded",
                                    value: "\(appState.messages.count)")
                        }
                    }

                    // About section
                    settingsSection(title: "About") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Studio Messenger v1.0")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(appState.theme.textPrimary)
                            Text("Native macOS studio console for Klub FM 104 & Radio Now. Displays shoutouts and requests in real time.")
                                .font(.system(size: 12))
                                .foregroundColor(appState.theme.textSecondary)
                                .lineSpacing(4)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(20)
            }
            .background(appState.theme.bgPrimary)
        }
        .frame(width: 400, height: 420)
        .background(appState.theme.bgPrimary)
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func settingsSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 10, weight: .black))
                .foregroundColor(appState.theme.textDim)
                .kerning(0.8)
                .textCase(.uppercase)
            content()
        }
    }

    private func infoRow(icon: String, label: String, value: String) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundColor(appState.theme.accent)
                .frame(width: 18)
            Text(label)
                .font(.system(size: 13))
                .foregroundColor(appState.theme.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(appState.theme.textPrimary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Theme Card

struct ThemeCard: View {
    let theme: StationTheme
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                AsyncImage(url: theme.logoURL) { img in
                    img.resizable().scaledToFit()
                } placeholder: {
                    RoundedRectangle(cornerRadius: 6).fill(theme.accentDim)
                }
                .frame(height: 40)
                .cornerRadius(6)

                Text(theme.rawValue)
                    .font(.system(size: 11, weight: isSelected ? .bold : .medium))
                    .foregroundColor(isSelected ? theme.accent : Color(white: 0.7))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(12)
            .frame(maxWidth: .infinity)
            .background(isSelected ? theme.accentDim : Color.white.opacity(0.04))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? theme.accent.opacity(0.5) : Color.white.opacity(0.07), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
