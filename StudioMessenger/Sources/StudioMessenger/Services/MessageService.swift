import Foundation

class MessageService {
    // ⚠️  Update this to your actual server path after uploading api/messages.php
    static let apiURL = "https://unitymedianetwork.com/onegoal/api/messages.php"

    func fetch(since: Int = 0) async throws -> [StudioMessage] {
        guard var components = URLComponents(string: Self.apiURL) else {
            throw URLError(.badURL)
        }
        if since > 0 {
            components.queryItems = [URLQueryItem(name: "since", value: "\(since)")]
        }
        guard let url = components.url else { throw URLError(.badURL) }

        let req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let raw = try JSONDecoder().decode(MessagesResponse.self, from: data)
        return raw.messages.map { $0.toMessage() }
    }
}
