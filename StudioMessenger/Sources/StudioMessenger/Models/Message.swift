import Foundation

enum MessageSource: String, Codable {
    case website  = "web"
    case whatsapp = "whatsapp"
}

struct StudioMessage: Identifiable, Equatable, Hashable {
    let id: Int
    let name: String
    let song: String
    let message: String
    let createdAt: Date
    let isShouted: Bool
    let source: MessageSource

    static func == (lhs: StudioMessage, rhs: StudioMessage) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - Codable bridge

struct StudioMessageRaw: Decodable {
    let id: Int
    let name: String
    let song: String
    let message: String
    let created_at: String
    let is_shouted: Int
    let source: String?
}

private let dateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd HH:mm:ss"
    f.locale = Locale(identifier: "en_US_POSIX")
    return f
}()

extension StudioMessageRaw {
    func toMessage() -> StudioMessage {
        StudioMessage(
            id: id,
            name: name.isEmpty ? "Anonymous" : name,
            song: song,
            message: message,
            createdAt: dateFormatter.date(from: created_at) ?? Date(),
            isShouted: is_shouted == 1,
            source: source == "whatsapp" ? .whatsapp : .website
        )
    }
}

struct MessagesResponse: Decodable {
    let messages: [StudioMessageRaw]
}
