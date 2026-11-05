# TAES

# How to test the application on a phone

## Requirements

- Python 3 (for the static server)
- [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (for the tunnel)

Install `cloudflared` with your package manager, for example:

```bash
# Arch Linux
sudo pacman -S cloudflared

# macOS
brew install cloudflared

# Windows
winget install Cloudflare.cloudflared
```

## 1. Terminal 1: serve the project folder

From the folder that contains `index.html` (the `PWA/` folder):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser to confirm the app loads. If you see a directory listing instead of the app, you are in the wrong folder.

## 2. Terminal 2: start the tunnel

Leave terminal 1 running and open a second terminal:

```bash
cloudflared tunnel --url http://localhost:8000
```

After a few seconds it prints a URL like `https://random-words.trycloudflare.com`. Copy it.

## 3. On your mobile phone

Open any browser and paste the `https://...trycloudflare.com` URL. The phone can be on mobile data or any Wi-Fi network. (**Except the school's network**)

To test it as an installed PWA, tap **Share → Add to Home Screen** and launch it from the home screen icon.

## Troubleshooting and notes

- **The URL changes every time** you restart the tunnel. Paste the new one on the phone.
- **Anyone with the URL can reach your server** while the tunnel is running. Stop both processes with `Ctrl+C` when you are done.
- **Stale files / service worker caching.** If changes do not show up, open the tunnel URL in a **Private tab**, or clear the site data on the browser. Each new tunnel URL is a new origin, so it starts with a clean cache anyway.
- **Absolute paths.** If the HTML references files like `/js/app.js`, make sure you serve from the folder the app expects as its root.
- **`BarcodeDetector` is not supported in iOS Safari** (to the best of my knowledge; verify on [caniuse.com](https://caniuse.com/mdn-api_barcodedetector)). If the feature works in desktop Chrome but not on the iPhone, a library such as [ZXing](https://github.com/zxing-js/library) or [html5-qrcode](https://github.com/mebjas/html5-qrcode) is the usual fallback.
