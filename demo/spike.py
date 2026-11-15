"""Run three REAL Gemini cases and write reviewable, uncommitted evidence."""
import argparse
import io
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from recipe_service import DEFAULT_MODEL, OUTPUT_SCHEMA, RecipeError, generate

CASES = [
    {'id': 'omnivore', 'ingredients': [{'name': 'frango cozinhado', 'available': '300 g'}, {'name': 'batata cozida', 'available': '400 g'}, {'name': 'azeite', 'available': '20 ml'}],
     'servings': 2, 'lifestyle': 'omnivore', 'allergies': [], 'excludedIngredients': []},
    {'id': 'vegan', 'ingredients': [{'name': 'grão-de-bico cozido', 'available': '500 g'}, {'name': 'tomate', 'available': '400 g'}, {'name': 'azeite', 'available': '20 ml'}],
     'servings': 3, 'lifestyle': 'vegan', 'allergies': [], 'excludedIngredients': ['cogumelos']},
    {'id': 'allergies', 'ingredients': [{'name': 'arroz cozido', 'available': '200 g'}, {'name': 'cenoura cozida', 'available': '150 g'}, {'name': 'azeite', 'available': '10 ml'}],
     'servings': 1, 'lifestyle': 'vegetarian', 'allergies': ['Peanuts', 'Milk', 'Eggs'], 'excludedIngredients': ['alho']},
]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repeat', type=int, default=1, choices=range(1, 4), help='Runs per input (1–3); each run consumes API quota.')
    args = parser.parse_args()
    if not os.environ.get('GEMINI_API_KEY'):
        parser.exit(2, 'Set GEMINI_API_KEY in your terminal first. Do not put it in source files.\n')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    directory = Path(__file__).parent / 'evidence' / stamp
    directory.mkdir(parents=True)
    results = []
    for case in CASES:
        for run in range(1, args.repeat + 1):
            envelopes = []
            def capture(request, timeout):
                with urlopen(request, timeout=timeout) as response:
                    raw = response.read(1_000_001)
                try:
                    envelopes.append(json.loads(raw))
                except ValueError:
                    envelopes.append({'unparseableText': raw.decode(errors='replace')})
                return io.BytesIO(raw)
            data = {key: value for key, value in case.items() if key != 'id'} | {'allowMissing': False}
            started = time.monotonic()
            record = {'case': case['id'], 'run': run, 'input': data, 'model': os.environ.get('GEMINI_MODEL', DEFAULT_MODEL), 'timestamp': datetime.now(timezone.utc).isoformat(),
                      'manualReview': {'ptPT': 'pending', 'restrictionsAndDerivatives': 'pending', 'measurementsAndQuantities': 'pending', 'instructionsAndTimes': 'pending'}}
            try:
                output = generate(data, opener=capture)
                record.update(output=output, automatedValidation='passed' if output['status'] == 'ready' else 'no_recipe')
            except RecipeError as error:
                record.update(automatedValidation='failed', error=error.code)
            record.update(seconds=round(time.monotonic() - started, 2), rawEnvelopes=envelopes)
            results.append(record)
            print(f"{case['id']} run {run}: {record['automatedValidation']} ({record['seconds']}s)")
            (directory / f"{case['id']}-{run}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    (directory / 'schema.json').write_text(json.dumps(OUTPUT_SCHEMA, ensure_ascii=False, indent=2) + '\n')
    print(f'Evidence: {directory}\nManual review remains required. No Product Owner acceptance is implied.')
    if any(record['automatedValidation'] != 'passed' for record in results):
        raise SystemExit(1)
