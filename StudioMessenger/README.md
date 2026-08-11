# Studio Messenger — macOS

Native macOS messaging console for Klub FM 104 & Radio Now.  
Displays shoutouts from the website in real time, Apple Messages style.

---

## Setup in Xcode

### 1. Create the Xcode project
1. Open Xcode → **File → New → Project**
2. Choose **macOS → App**
3. Name: `StudioMessenger`
4. Interface: **SwiftUI**, Language: **Swift**
5. Minimum deployment: **macOS 14.0**
6. Uncheck "Include Tests"

### 2. Add the source files
Delete the auto-generated `ContentView.swift` then drag **all `.swift` files** from `Sources/StudioMessenger/` into the Xcode project navigator, keeping the folder structure.  
When prompted, tick **"Copy items if needed"** and **"Add to target: StudioMessenger"**.

### 3. Configure entitlements
In Xcode, select the project → target → **Signing & Capabilities**:
- Add **App Sandbox**
- Under Sandbox, enable: **Outgoing Connections (Client)**

This allows the app to reach your server API.

### 4. Upload the PHP API
Upload `api/messages.php` to your server at:
```
https://unitymedianetwork.com/onegoal/api/
```
Test it in a browser — you should see JSON like:
```json
{"messages":[...],"count":5,"timestamp":1234567890}
```

### 5. Build & Run
Press **⌘R** in Xcode. The app will:
- Auto-fetch messages on launch
- Poll for new messages every 5 seconds
- Switch themes via the gear icon → Settings

---

## Theme Colours

| Station    | Accent          | Hex       |
|------------|-----------------|-----------|
| Klub FM    | Cyan / Electric | `#00d2ff` |
| Radio Now  | Magenta / Pink  | `#ff2d78` |

---

## Adding WhatsApp Messages Later
Add a `source = 'whatsapp'` column to `studio_requests` (or a separate table).  
The app already handles `source: "whatsapp"` in the JSON — it shows a green phone badge on those messages.
