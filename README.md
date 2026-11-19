# SmartPantry (TAES)

## Run the app

Requires **Node.js 22 or newer**. The application server uses only Node's built-in modules, so no dependency installation is needed to start it.

1. Open `.env` in the repository root. If it does not exist, copy `.env.example` and name the copy `.env`.
2. Paste your Gemini API key after `=` and save the file:

```dotenv
GEMINI_API_KEY=your_actual_key
```

Replace `your_actual_key` with your key from [Google AI Studio](https://aistudio.google.com/apikey). Do this once. `.env` is ignored by Git and stays outside the public `PWA/` folder. The shareable `.env.example` contains no credentials.
3. From the repository root, start the app:

```bash
node server.js
```

`npm start` runs the same command.
4. Visit **http://localhost:8000/**, create/select a household profile, and open recipes from the pantry.

The optional `GEMINI_MODEL` setting selects another accessible structured-output model. Confirm free-tier availability in your own Google project. The app does not enable billing or automatically switch models. A missing/invalid key or inaccessible model produces a configuration message. Do not place `.env` or API credentials inside `PWA/`.

Press **Ctrl+C** to stop the app. `node server.js --port 8001` selects another port; Katalon expects 8000. Use this server for recipe generation: a plain static server cannot forward Gemini requests. Other local features and saved recipes remain usable without a configured Gemini key.

## Project structure

- `PWA/`: browser pages, scripts, styles and offline assets, including recipe generation and local saving.
- `PWA/tests/`: Node tests and the explicitly invoked live recipe experiment.
- `server.js`: serves only `PWA/` and forwards `/api/generate-recipe` to Gemini. The root `.env` stays private, and hidden files and escaping symlinks are rejected for GET/HEAD.
- `Katalon/`: Gherkin acceptance scenarios, Groovy steps and browser runners.

## Tests

Run from the repository root:

```bash
node --test PWA/tests/*.test.js
```


# How to test the application on a phone

## Requirements

- Node.js 22 or newer (for the application server)
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

From the repository root (the folder containing this README), after setting up `.env` above:

```bash
node server.js
```

Open `http://localhost:8000` in a browser to confirm the app loads. Leave the server running while using the phone.

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