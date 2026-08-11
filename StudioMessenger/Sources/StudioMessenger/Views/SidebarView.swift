import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    @Binding var showSettings: Bool
    @State private var search = ""

    var filtered: [StudioMessage] {
        guard !search.isEmpty else { return appState.messages }
        let q = search.lowercased()
        return appState.messages.filter {
            $0.name.lowercased().contains(q) ||
            $0.message.lowercased().contains(q) ||
            $0.song.lowercased().contains(q)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            searchBar
            Divider().background(appState.theme.borderColor)
            messageList
            statusFooter
        }
        .background(appState.theme.bgSecondary)
    }

    // MARK: Header
    private var headerBar: some View {
        HStack(spacing: 10) {
            AsyncImage(url: appState.theme.logoURL) { img in
                img.resizable().scaledToFit()
            } placeholder: {
                RoundedRectangle(cornerRadius: 6)
                    .fill(appState.theme.accentDim)
            }
            .frame(width: 30, height: 30)
            .cornerRadius(6)

            Text(appState.theme.rawValue)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(appState.theme.accent)

            Spacer()

            if case .fetching = appState.connectionStatus {
                ProgressView()
                    .progressViewStyle(.circular)
                    .scaleEffect(0.55)
                    .tint(appState.theme.accent)
            }

            Button { showSettings = true } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(appState.theme.textDim)
            }
            .buttonStyle(.plain)
            .help("Settings")
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(appState.theme.bgSecondary)
    }

    // MARK: Search
    private var searchBar: some View {
        HStack(spacing: 7) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12))
                .foregroundColor(appState.theme.textDim)
            TextField("Search shoutouts…", text: $search)
                .font(.system(size: 13))
                .foregroundColor(appState.theme.textPrimary)
                .textFieldStyle(.plain)
            if !search.isEmpty {
                Button { search = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(appState.theme.textDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(appState.theme.bgCard)
        .cornerRadius(8)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(appState.theme.bgSecondary)
    }

    // MARK: List
    @ViewBuilder
    private var messageList: some View {
        if filtered.isEmpty && !appState.isLoading {
            Spacer()
            VStack(spacing: 10) {
                Image(systemName: appState.isLoading ? "arrow.clockwise" : "tray")
                    .font(.system(size: 30))
                    .foregroundColor(appState.theme.textDim)
                Text(search.isEmpty ? "No messages yet" : "No results")
                    .font(.system(size: 13))
                    .foregroundColor(appState.theme.textDim)
            }
            Spacer()
        } else {
            List(filtered, selection: Binding(
                get: { appState.selected },
                set: { appState.selected = $0 }
            )) { msg in
                ConversationRowView(message: msg)
                    .tag(msg)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(
                        appState.selected == msg
                            ? appState.theme.accentDim
                            : Color.clear
                    )
                    .listRowSeparatorTint(appState.theme.borderColor)
            }
            .listStyle(.sidebar)
            .scrollContentBackground(.hidden)
            .background(appState.theme.bgSecondary)
        }
    }

    // MARK: Footer
    @ViewBuilder
    private var statusFooter: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(statusColor)
                .frame(width: 5, height: 5)
            Text(appState.connectionStatus.label)
                .font(.system(size: 10))
                .foregroundColor(appState.theme.textDim)
            Spacer()
            Text("\(appState.messages.count) messages")
                .font(.system(size: 10))
                .foregroundColor(appState.theme.textDim)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(appState.theme.bgSecondary)
    }

    private var statusColor: Color {
        switch appState.connectionStatus {
        case .ok:      return .green
        case .error:   return .red
        default:       return appState.theme.textDim
        }
    }
}

// MARK: - Conversation Row

struct ConversationRowView: View {
    @EnvironmentObject var appState: AppState
    let message: StudioMessage

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            // Avatar
            ZStack {
                Circle()
                    .fill(appState.theme.accentDim)
                    .frame(width: 40, height: 40)
                Text(String(message.name.prefix(1)).uppercased())
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(appState.theme.accent)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(message.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(appState.theme.textPrimary)
                    Spacer()
                    Text(message.createdAt, style: .time)
                        .font(.system(size: 11))
                        .foregroundColor(appState.theme.textDim)
                }

                Text(message.message)
                    .font(.system(size: 12))
                    .foregroundColor(appState.theme.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                if message.song != "DJ Choice" && !message.song.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "music.note")
                            .font(.system(size: 9))
                        Text(message.song)
                            .font(.system(size: 11))
                            .lineLimit(1)
                    }
                    .foregroundColor(appState.theme.accent.opacity(0.85))
                }
            }

            // Source badge
            if message.source == .whatsapp {
                Image(systemName: "phone.fill")
                    .font(.system(size: 9))
                    .padding(4)
                    .background(Color(red: 0.145, green: 0.831, blue: 0.400).opacity(0.18))
                    .foregroundColor(Color(red: 0.145, green: 0.831, blue: 0.400))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
    }
}
