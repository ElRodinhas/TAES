# US-15 classroom demo and GenAI spike

This local service serves `PWA/` and forwards `POST /api/generate-recipe` to Gemini. It uses Python's standard library; no package installation, cloud database or cloud deployment is required. Household and inventory storage formats are unchanged. Generated recipes use the new device-local key `smartPantry.generatedRecipes.v1` (a JSON array).

## Start the demo

Requires Python 3.10 or newer and internet access for new recipes.

1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey). Choose a project with free-tier access; do not enable billing for this experiment. Model availability and quotas depend on the project. The app does not automatically switch models or enable paid access.
2. From the repository root, set the key privately in your Bash terminal:

   ```bash
   read -rsp 'Gemini API key: ' GEMINI_API_KEY
   export GEMINI_API_KEY
   printf '\n'
   python3 demo/server.py
   ```

   `read -r` preserves backslashes, `-s` hides input, and `-p` displays the prompt. `export` makes the key available to the server process. The value is not typed into shell history or written to a file. This server reads environment variables; it does not load `.env` files.

3. Visit `http://localhost:8000/`, create/select a household, then open the recipes page from the pantry. Or visit `http://localhost:8000/recipes.html` when a profile already exists on that origin.
4. Select pantry items and/or add named leftovers with optional quantities such as `200 g`. Set the requested portions and choose **Gerar receita**. If needed, explicitly permit missing ingredients. Choose **Guardar receita** to retain the result locally.
5. Keep this terminal open during the demonstration. Press Ctrl+C to stop the server, then `unset GEMINI_API_KEY` to remove the key from that terminal's environment.

Use this server **instead of** `python -m http.server 8000 --directory PWA` for US-15. Both cannot use port 8000 simultaneously. The original static server still serves the app but cannot forward generation requests. The demo server binds to the local computer only; remote/mobile hosting is outside this iteration. `--port 8001` chooses a different port, but browser storage is separate for each origin and Katalon expects 8000.

The default model is `gemini-3.5-flash-lite`, listed with free input/output in Google's [pricing documentation](https://ai.google.dev/gemini-api/docs/pricing). To select another available structured-output model explicitly, set `GEMINI_MODEL` before starting, for example `export GEMINI_MODEL=your-model-id`. Confirm free-tier availability in your own project. Invalid keys, inaccessible models and incompatible API configuration produce a configuration error. Never add keys to HTML, JavaScript, test fixtures, screenshots or committed reports.

## Behavior and limits

- The active household supplies lifestyle, allergies, excluded ingredients and default portions. A request may override portions from 1–30. No household name or ID is sent to Gemini. A valid profile and at least one ingredient are required.
- The model may use a subset of the input. It must first attempt a recipe with no extras, including staples such as salt or oil. Tap water is permitted in instructions. A `no_recipe` response offers a consent button; only a second request after consent permits extra ingredients. Every extra has `sourceIndex: null` and is displayed as **Em falta**. Editing inputs cancels pending consent.
- The schema requires a title, exact requested servings, preparation/cooking/total minutes, positive ingredient quantities and units, and ordered instructions. Model-generated text is requested in pt-PT, with °C and metric units. Supplied ingredient names are retained exactly to validate their origin. The model is instructed to respect available amounts, but interpreting free-text quantities and checking culinary feasibility still require manual review.
- The service validates structure, source indices, known restriction terms and serving counts. A conservative Portuguese/English term list rejects known conflicts in supplied ingredients and output, including instructions. It is **not a complete allergen/ingredient ontology**: derivatives, brands, ambiguous ingredients, spelling variants and compound foods can escape it; negative phrases can also cause false positives. Schema validity and model self-report do not guarantee dietary safety. Inspect all three spike outputs manually, including steps and labels, before calling the spike successful.
- The model reports whether it can propose a recipe; `no_recipe` does not prove that no possible recipe exists. “Original” means generated rather than fetched from a catalogue; global uniqueness cannot be established.
- Saved recipes are shared across profiles and remain readable offline. Switching profiles does not revalidate or rewrite saved recipes. Save failures are visible and retain the displayed recipe. Clearing browser site data removes saved recipes. This iteration provides saving and reading; editing/deletion and import/export are outside US-15.
- The service worker v4 includes recipe page assets. First load online and wait for installation before an offline demonstration. Updating the app-shell cache does not remove localStorage data.
- The Gemini free tier processes ingredient/restriction data under Google's applicable [terms](https://ai.google.dev/gemini-api/terms). Use the synthetic spike inputs for evidence; review provider terms before using personal information.
- Existing Spoonacular catalogue search is separate. Its existing client-side API credential was not copied into this integration.

## Failures and retries

| Outcome | Handling |
| --- | --- |
| Network failure, timeout, HTTP 500/502/503/504 | At most one automatic retry after 1 second; 25-second socket timeout per attempt |
| HTTP 429 quota/rate limit | No automatic retry; ask the user to try later |
| Missing key, rejected credentials, unavailable model or invalid API configuration | Show configuration error; no automatic retry |
| Blocked, truncated, malformed or incomplete output | Do not display/save it; no automatic retry |
| Detected dietary conflict | Reject it; ask the user to review ingredients |
| No recipe without extras | Ask for explicit permission before sending an extras-enabled request |
| Offline | Do not attempt generation; retain input and saved recipes |
| Browser storage failure | Explain that saving failed; keep generated output visible |

The browser has a 60-second request deadline and disables repeat submission while waiting. It does not retry on top of the service's retries. Inputs survive unsuccessful requests. A lost response can consume API quota even if the browser cannot show it.

## Spike evidence

With the key exported, run:

```bash
python3 demo/spike.py
```

This makes live calls for three distinct inputs: omnivore leftovers (2 portions), vegan leftovers with an exclusion (3), and vegetarian leftovers with milk/egg/peanut allergies plus an exclusion (1). For more evidence, `python3 demo/spike.py --repeat 3` makes nine requests, excluding possible transient retries. Every call consumes the project's quota.

Timestamped records are written under ignored `demo/evidence/`. Each contains input, model, elapsed time, raw successful-response envelopes, validated output or an error, and **pending** manual-review fields. HTTP errors are recorded by error code without credentials or provider error bodies. No live evidence has been fabricated. Manually review pt-PT, restrictions and derivatives in both ingredients and instructions, available quantities, measurements, temperatures, time plausibility and portions. Record observations and the model/date in the team's spike report. The runner exits with failure if any case does not return a valid recipe; a `no_recipe` outcome does not satisfy the three-success criterion.

The spike remains pending until there are valid outputs for all three inputs, dietary checks have been completed manually, and the team has reviewed the error/retry decision above. Repeat runs provide stronger evidence than three isolated successes.

## Verification

From the repository root:

```bash
python3 -m unittest discover -s demo/tests -v
node --test PWA/tests/generated.recipes.test.js
node --test PWA/tests/*.test.js
```

The Python tests simulate Gemini responses and verify request contents, output validation, restrictions, consent rules and retry limits. The new Node tests execute the actual browser event handlers with a minimal DOM, checking combined inputs, local persistence, consent, profile changes, failures and safe text rendering. They do not replace browser testing.

In **Katalon Studio**, with the local server running on port 8000, execute **US-15 Generate recipes**. `GenerateRecipes.feature` and `GenerateRecipesSteps.groovy` exercise the browser with a stubbed recipe endpoint so acceptance tests do not need a key or consume quota. Hooks are scoped to `@generate-recipes` and have `void` signatures. Live Gemini integration is covered separately by the spike runner. Also manually verify a narrow phone viewport, service-worker installation and a complete offline reload of saved recipes.

Known baseline: the unchanged `profile.switching.test.js` has an assertion expecting deletion of the active profile; current `app.js` explicitly prevents that deletion. This unrelated failure is not fixed as part of US-15. Katalon, live Gemini runs, mobile appearance and the installed-PWA offline flow must be checked before declaring the story done. Product Owner acceptance remains a sprint-review decision.
