import SwiftUI

enum StationTheme: String, CaseIterable, Identifiable {
    case klubFM   = "Klub FM 104"
    case radioNow = "Radio Now"

    var id: String { rawValue }

    // MARK: Brand colours
    var accent: Color {
        switch self {
        case .klubFM:   return Color(red: 0.00, green: 0.824, blue: 1.00)   // #00d2ff
        case .radioNow: return Color(red: 1.00, green: 0.176, blue: 0.471)  // #ff2d78
        }
    }

    var accentSecondary: Color {
        switch self {
        case .klubFM:   return Color(red: 0.216, green: 0.404, blue: 0.945) // #3767f1
        case .radioNow: return Color(red: 0.486, green: 0.227, blue: 0.929) // #7c3aed
        }
    }

    var accentDim: Color { accent.opacity(0.15) }
    var accentMid: Color { accent.opacity(0.35) }

    // MARK: Surfaces (matches the website's #05050a bg family)
    var bgPrimary:   Color { Color(red: 0.020, green: 0.020, blue: 0.039) }
    var bgSecondary: Color { Color(red: 0.035, green: 0.035, blue: 0.058) }
    var bgCard:      Color { Color(red: 0.060, green: 0.060, blue: 0.090) }
    var borderColor: Color { Color.white.opacity(0.07) }

    // MARK: Text — all high-contrast
    var textPrimary:   Color { Color(white: 0.97) }
    var textSecondary: Color { Color(white: 0.72) }
    var textDim:       Color { Color(white: 0.48) }

    // MARK: Logo URL
    var logoURL: URL? {
        switch self {
        case .klubFM:
            return URL(string: "https://unitymedianetwork.com/onegoal/hero.png")
        case .radioNow:
            return URL(string: "https://unitymedianetwork.com/onegoal/hero2.jpeg")
        }
    }

    // MARK: Gradient used for selected bubbles / highlights
    var bubbleGradient: LinearGradient {
        switch self {
        case .klubFM:
            return LinearGradient(
                colors: [Color(red: 0.00, green: 0.824, blue: 1.00),
                         Color(red: 0.216, green: 0.404, blue: 0.945)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
        case .radioNow:
            return LinearGradient(
                colors: [Color(red: 1.00, green: 0.176, blue: 0.471),
                         Color(red: 0.486, green: 0.227, blue: 0.929)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
        }
    }
}
