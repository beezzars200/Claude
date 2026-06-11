import SwiftUI
import Combine

@MainActor
class AppState: ObservableObject {
    @Published var theme: StationTheme = .klubFM
    @Published var messages: [StudioMessage] = []
    @Published var selected: StudioMessage? = nil
    @Published var isLoading = false
    @Published var connectionStatus: ConnectionStatus = .idle
    @Published var lastUpdated: Date? = nil

    enum ConnectionStatus {
        case idle, fetching, ok, error(String)
        var label: String {
            switch self {
            case .idle:         return "Waiting"
            case .fetching:     return "Refreshing…"
            case .ok:           return "Live"
            case .error(let e): return "⚠️ \(e)"
            }
        }
    }

    private let service = MessageService()
    private var timer: AnyCancellable?
    private var maxID: Int = 0

    init() {
        if let saved = UserDefaults.standard.string(forKey: "studioTheme"),
           let t = StationTheme(rawValue: saved) {
            theme = t
        }
        startPolling()
    }

    func setTheme(_ t: StationTheme) {
        theme = t
        UserDefaults.standard.set(t.rawValue, forKey: "studioTheme")
    }

    func startPolling() {
        fetchAll()
        timer = Timer.publish(every: 5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.fetchIncremental() }
    }

    // First load — fetch everything
    private func fetchAll() {
        Task {
            isLoading = true
            connectionStatus = .fetching
            do {
                let fetched = try await service.fetch()
                messages = fetched.sorted { $0.createdAt > $1.createdAt }
                maxID = messages.first?.id ?? 0
                lastUpdated = Date()
                connectionStatus = .ok
            } catch {
                connectionStatus = .error(error.localizedDescription)
            }
            isLoading = false
        }
    }

    // Subsequent polls — only fetch new entries
    private func fetchIncremental() {
        Task {
            connectionStatus = .fetching
            do {
                let fetched = try await service.fetch(since: maxID)
                if !fetched.isEmpty {
                    let existingIDs = Set(messages.map(\.id))
                    let newOnes = fetched.filter { !existingIDs.contains($0.id) }
                    if !newOnes.isEmpty {
                        messages.insert(contentsOf: newOnes.sorted { $0.createdAt > $1.createdAt },
                                        at: 0)
                        maxID = messages.map(\.id).max() ?? maxID
                    }
                }
                lastUpdated = Date()
                connectionStatus = .ok
            } catch {
                connectionStatus = .error(error.localizedDescription)
            }
        }
    }

    func refresh() { fetchAll() }
}
