import SwiftUI

// MARK: - Detail Router

struct DetailView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if let msg = appState.selected {
                MessageDetailView(message: msg)
                    .id(msg.id)             // re-render when selection changes
            } else {
                EmptyDetailView()
            }
        }
        .background(appState.theme.bgPrimary)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Empty State

struct EmptyDetailView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 52))
                .foregroundStyle(appState.theme.bubbleGradient)
            Text("No message selected")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(appState.theme.textSecondary)
            Text("Choose a shoutout from the list")
                .font(.system(size: 13))
                .foregroundColor(appState.theme.textDim)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(appState.theme.bgPrimary)
    }
}

// MARK: - Message Detail

struct MessageDetailView: View {
    @EnvironmentObject var appState: AppState
    let message: StudioMessage

    var body: some View {
        VStack(spacing: 0) {
            detailHeader
            Divider().background(appState.theme.borderColor)
            messageBody
        }
        .background(appState.theme.bgPrimary)
    }

    // MARK: Header bar
    private var detailHeader: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(appState.theme.accentDim)
                    .frame(width: 38, height: 38)
                Text(String(message.name.prefix(1)).uppercased())
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(appState.theme.accent)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(message.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(appState.theme.textPrimary)
                Text(message.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.system(size: 11))
                    .foregroundColor(appState.theme.textDim)
            }

            Spacer()

            // Source chip
            sourceChip

            // Shouted badge
            if message.isShouted {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 11))
                    Text("Shouted")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundColor(appState.theme.accent)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(appState.theme.accentDim)
                .cornerRadius(999)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(appState.theme.bgSecondary)
    }

    @ViewBuilder
    private var sourceChip: some View {
        let isWA = message.source == .whatsapp
        let waGreen = Color(red: 0.145, green: 0.831, blue: 0.400)
        HStack(spacing: 4) {
            Image(systemName: isWA ? "phone.fill" : "globe")
                .font(.system(size: 10))
            Text(isWA ? "WhatsApp" : "Web")
                .font(.system(size: 11, weight: .bold))
        }
        .foregroundColor(isWA ? waGreen : appState.theme.accent)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background((isWA ? waGreen : appState.theme.accent).opacity(0.15))
        .cornerRadius(999)
    }

    // MARK: Scrollable body
    private var messageBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Date stamp
                Text(message.createdAt.formatted(date: .complete, time: .omitted))
                    .font(.system(size: 11))
                    .foregroundColor(appState.theme.textDim)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 12)

                // Song request card (if any)
                if !message.song.isEmpty && message.song != "DJ Choice" {
                    songRequestCard
                }

                // Message bubble — left-aligned (incoming from listener)
                HStack(alignment: .bottom, spacing: 8) {
                    ZStack {
                        Circle()
                            .fill(appState.theme.accentDim)
                            .frame(width: 28, height: 28)
                        Text(String(message.name.prefix(1)).uppercased())
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(appState.theme.accent)
                    }
                    MessageBubbleView(text: message.message)
                    Spacer(minLength: 60)
                }

                Text(message.createdAt.formatted(date: .omitted, time: .shortened))
                    .font(.system(size: 10))
                    .foregroundColor(appState.theme.textDim)
                    .padding(.leading, 36)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .background(appState.theme.bgPrimary)
    }

    // MARK: Song request card
    private var songRequestCard: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(appState.theme.accentDim)
                    .frame(width: 42, height: 42)
                Image(systemName: "music.note.list")
                    .font(.system(size: 18))
                    .foregroundColor(appState.theme.accent)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("SONG REQUEST")
                    .font(.system(size: 9, weight: .black))
                    .foregroundColor(appState.theme.textDim)
                    .kerning(0.8)
                Text(message.song)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(appState.theme.textPrimary)
            }
            Spacer()
        }
        .padding(14)
        .background(appState.theme.bgCard)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(appState.theme.accent.opacity(0.25), lineWidth: 1)
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Message Bubble

struct MessageBubbleView: View {
    @EnvironmentObject var appState: AppState
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 14))
            .foregroundColor(appState.theme.textPrimary)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(appState.theme.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(appState.theme.accent.opacity(0.25), lineWidth: 1)
            )
    }
}
