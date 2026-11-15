import io
import json
import sys
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from recipe_service import RecipeError, generate, validate_input, validate_output


def request_data():
    return {'ingredients': [{'name': 'tomate', 'available': '300 g'}, {'name': 'arroz cozido', 'available': '200 g'}],
            'servings': 2, 'lifestyle': 'vegan', 'allergies': ['Peanuts'], 'excludedIngredients': ['cogumelos'], 'allowMissing': False}


def recipe_output():
    return {'status': 'ready', 'recipe': {'title': 'Arroz de tomate', 'servings': 2, 'prepMinutes': 5, 'cookMinutes': 10, 'totalMinutes': 15,
            'ingredients': [{'name': 'tomate', 'quantity': 300, 'unit': 'g', 'sourceIndex': 0}, {'name': 'arroz cozido', 'quantity': 200, 'unit': 'g', 'sourceIndex': 1}],
            'steps': ['Corta o tomate.', 'Aquece o tomate e junta o arroz cozido.']}}


def response(output=None, **extra):
    body = {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps(output or recipe_output())}]}}]}
    body.update(extra)
    return io.BytesIO(json.dumps(body).encode())


class RecipeTests(unittest.TestCase):
    def assert_code(self, code, function, *args, **kwargs):
        with self.assertRaises(RecipeError) as error:
            function(*args, **kwargs)
        self.assertEqual(code, error.exception.code)

    def test_structured_request_contains_all_inputs_and_no_profile_name(self):
        requests = []
        def opener(req, timeout):
            requests.append(req)
            self.assertEqual(timeout, 25)
            return response()
        self.assertEqual(generate(request_data(), key='test', opener=opener), recipe_output())
        body = json.loads(requests[0].data)
        self.assertEqual(json.loads(body['contents'][0]['parts'][0]['text']), request_data())
        self.assertEqual(body['generationConfig']['responseMimeType'], 'application/json')
        self.assertIn('recipe', body['generationConfig']['responseJsonSchema']['properties'])
        self.assertNotIn('test', requests[0].full_url)

    def test_empty_ingredients_and_invalid_servings_rejected(self):
        for value in [0, 31, 1.5, True, '2']:
            data = request_data()
            data['servings'] = value
            self.assert_code('INPUT', validate_input, data)
        data = request_data()
        data['ingredients'] = []
        self.assert_code('INPUT', validate_input, data)

    def test_input_restrictions_block_before_api_call(self):
        for name in ['amendoim', 'cogumelos', 'frango', 'queijo']:
            data = request_data()
            data['ingredients'][0]['name'] = name
            self.assert_code('RESTRICTION', generate, data, key='test', opener=lambda *a, **k: self.fail('API called'))

    def test_subset_of_supplied_ingredients_is_allowed(self):
        output = recipe_output()
        output['recipe']['ingredients'].pop()
        self.assertEqual(validate_output(output, request_data()), output)

    def test_missing_ingredients_require_permission(self):
        output = recipe_output()
        output['recipe']['ingredients'].append({'name': 'azeite', 'quantity': 10, 'unit': 'ml', 'sourceIndex': None})
        self.assert_code('INVALID_RECIPE', validate_output, output, request_data())
        data = request_data()
        data['allowMissing'] = True
        self.assertEqual(validate_output(output, data), output)

    def test_forged_source_and_restriction_violations_rejected(self):
        for name in ['azeite', 'amendoim']:
            output = recipe_output()
            output['recipe']['ingredients'][0]['name'] = name
            self.assert_code('INVALID_RECIPE', validate_output, output, request_data())
        output = recipe_output()
        output['recipe']['steps'].append('Junta leite.')
        self.assert_code('RESTRICTION', validate_output, output, request_data())

    def test_allergen_extra_rejected_even_with_permission(self):
        data = request_data()
        data['allowMissing'] = True
        output = recipe_output()
        output['recipe']['ingredients'].append({'name': 'amendoim', 'quantity': 10, 'unit': 'g', 'sourceIndex': None})
        self.assert_code('RESTRICTION', validate_output, output, data)

    def test_bad_measurements_times_steps_and_portions_rejected(self):
        for key, value in [('servings', 3), ('prepMinutes', -1), ('totalMinutes', 0), ('steps', []), ('steps', [''])]:
            output = recipe_output()
            output['recipe'][key] = value
            self.assert_code('INVALID_RECIPE', validate_output, output, request_data())
        for value in [0, -1, True, float('nan'), float('inf')]:
            output = recipe_output()
            output['recipe']['ingredients'][0]['quantity'] = value
            self.assert_code('INVALID_RECIPE', validate_output, output, request_data())

    def test_no_recipe_is_a_valid_outcome(self):
        self.assertEqual(validate_output({'status': 'no_recipe', 'recipe': None}, request_data()), {'status': 'no_recipe', 'recipe': None})

    def test_temporary_server_failure_retried_once(self):
        calls = []
        def opener(*args, **kwargs):
            calls.append(1)
            if len(calls) == 1:
                raise HTTPError('https://example.test', 503, 'unavailable', {}, None)
            return response()
        self.assertEqual(generate(request_data(), key='test', opener=opener, sleeper=lambda n: None), recipe_output())
        self.assertEqual(len(calls), 2)

    def test_timeout_and_network_failure_bounded_to_two_attempts(self):
        for failure, code in [(TimeoutError(), 'TIMEOUT'), (URLError('offline'), 'UNAVAILABLE')]:
            calls = []
            def opener(*args, **kwargs):
                calls.append(1)
                raise failure
            self.assert_code(code, generate, request_data(), key='test', opener=opener, sleeper=lambda n: None)
            self.assertEqual(len(calls), 2)

    def test_quota_and_auth_failures_are_not_retried(self):
        for status, code in [(429, 'QUOTA'), (403, 'NOT_CONFIGURED'), (404, 'NOT_CONFIGURED')]:
            calls = []
            def opener(*args, **kwargs):
                calls.append(1)
                raise HTTPError('https://example.test', status, 'error', {}, None)
            self.assert_code(code, generate, request_data(), key='test', opener=opener)
            self.assertEqual(len(calls), 1)

    def test_blocked_and_malformed_output_are_not_retried(self):
        for raw, code in [(b'{', 'INVALID_RECIPE'), (b'{"candidates": []}', 'BLOCKED'),
                          (b'{"candidates": [{"finishReason":"MAX_TOKENS"}]}', 'INVALID_RECIPE')]:
            calls = []
            def opener(*args, **kwargs):
                calls.append(1)
                return io.BytesIO(raw)
            self.assert_code(code, generate, request_data(), key='test', opener=opener)
            self.assertEqual(len(calls), 1)


if __name__ == '__main__':
    unittest.main()
