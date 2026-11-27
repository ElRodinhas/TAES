package smartpantry.steps

import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import io.cucumber.datatable.DataTable
import io.cucumber.java.After
import io.cucumber.java.Before
import io.cucumber.java.en.Given
import io.cucumber.java.en.Then
import io.cucumber.java.en.When

class RecipeCardMissingIngredientsSteps {
    private static final String BASE_URL = 'http://localhost:8000/'
    private static final String SHOPPING_KEY = 'smartPantry.shoppingList'
    private static final String PANTRY_KEY = 'smartPantry_inventory'
    private List pantry

    private TestObject xpath(String expression) {
        TestObject object = new TestObject(expression)
        object.addProperty('xpath', ConditionType.EQUALS, expression)
        return object
    }

    // Titles are fixed test fixtures, never user-provided XPath fragments.
    private String cardPath(String title) {
        assert title in ['Tomato rice', 'Tomato soup', 'Fresh tomato']
        return "//div[@id='recipes-list']/article[.//h3[normalize-space(.)='${title}']]"
    }

    private TestObject addButton(String title) {
        return xpath(cardPath(title) + "//button[contains(normalize-space(.), 'Adicionar Ingredientes em Falta')]")
    }

    private void store(String key, Object value) {
        WebUI.executeJavaScript('localStorage.setItem(arguments[0], arguments[1]);', [key, JsonOutput.toJson(value)])
    }

    private Object read(String key) {
        String value = (String) WebUI.executeJavaScript('return localStorage.getItem(arguments[0]);', [key])
        assert value != null : "Expected stored data at ${key}"
        return new JsonSlurper().parseText(value)
    }

    private List tableItems(DataTable table) {
        return table.asMaps(String, String).collect { row ->
            [name: row.name, quantity: new BigDecimal(row.quantity), unit: row.unit, checked: row.checked == 'true']
        }
    }

    @Before('@recipe-card-missing-ingredients')
    void openBrowser() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(BASE_URL + 'recipes.html')
        // Seed only the three relevant keys on this dedicated localhost test origin.
    }

    @After('@recipe-card-missing-ingredients')
    void closeBrowser() {
        WebUI.closeBrowser()
    }

    @Given('US-23 discovery has a pantry containing Tomato and fixed recipe results')
    void prepareDiscovery() {
        pantry = [[id: 'us23-tomato', name: 'Tomato', quantity: 3, unit: 'un', expiry: '2099-12-31']]
        store(PANTRY_KEY, pantry)
        store(SHOPPING_KEY, [])
        store('smartPantry.households.v1', [version: 1, activeHouseholdId: 'us23-home', households: [
            [id: 'us23-home', name: 'US-23 Household', servings: 2, lifestyle: 'omnivore', allergies: [], excludedIngredients: []]
        ]])
        WebUI.refresh()
        WebUI.waitForElementClickable(xpath("//button[@id='btn-fetch-recipes']"), 10)

        // Replace only the discovery API response. Rendering and transfer remain real app code.
        List recipes = [
            [id: 2301, title: 'Tomato rice', usedIngredients: [[name: 'Tomato']], missedIngredients: [
                [name: 'Onion', amount: 2, unit: 'un'], [name: 'Rice', amount: 200, unit: 'g']
            ]],
            [id: 2302, title: 'Tomato soup', usedIngredients: [[name: 'Tomato']], missedIngredients: [
                [name: 'Carrot', amount: 1, unit: 'un']
            ]],
            [id: 2303, title: 'Fresh tomato', usedIngredients: [[name: 'Tomato']], missedIngredients: []]
        ]
        recipes.each { it.image = './icons/icon-192.png' }
        WebUI.executeJavaScript('''
            const payload = JSON.parse(arguments[0]);
            const originalFetch = window.fetch.bind(window);
            window.fetch = function(input, options) {
                const url = new URL(typeof input === 'string' ? input : input.url, location.href);
                if (url.hostname === 'api.spoonacular.com' && url.pathname === '/recipes/complexSearch') {
                    return Promise.resolve({ok: true, json: () => Promise.resolve(payload)});
                }
                return originalFetch(input, options);
            };
        ''', [JsonOutput.toJson([results: recipes])])
    }

    @Given('the US-23 shopping list contains:')
    void seedShoppingList(DataTable table) {
        store(SHOPPING_KEY, tableItems(table))
    }

    @When('I search the US-23 discovery catalogue')
    void search() {
        WebUI.click(xpath("//button[@id='btn-fetch-recipes']"))
        for (String title : ['Tomato rice', 'Tomato soup', 'Fresh tomato']) {
            WebUI.waitForElementVisible(xpath(cardPath(title)), 10)
        }
        WebUI.verifyElementText(xpath("//span[@id='recipe-count']"), '3')
    }

    @Then('the US-23 card {string} shows missing ingredients {string}')
    void verifyMissing(String title, String ingredients) {
        TestObject indicator = xpath(cardPath(title) + "//p[strong[contains(., 'Falta:')]]")
        WebUI.verifyElementVisible(indicator)
        String text = WebUI.getText(indicator).replaceFirst('(?s)^.*?Falta:\\s*', '').trim()
        assert text.split(',').collect { it.trim() } == ingredients.split(',').collect { it.trim() }
    }

    @Then('each US-23 discovery card has one add-missing button')
    void verifyButtons() {
        for (String title : ['Tomato rice', 'Tomato soup', 'Fresh tomato']) {
            TestObject button = addButton(title)
            assert WebUI.findWebElements(button, 5).size() == 1
            WebUI.verifyElementVisible(button)
            WebUI.verifyElementClickable(button)
        }
    }

    @When('I click add missing once on the US-23 card {string}')
    void transfer(String title) {
        WebUI.click(addButton(title))
        // Current UI uses an informational alert after saving, not an extra transfer confirmation.
        // Permit implementations that show inline feedback instead.
        if (WebUI.waitForAlert(1, FailureHandling.OPTIONAL)) {
            WebUI.acceptAlert()
        }
    }

    @Then('the US-23 shopping list contains exactly:')
    void verifyShoppingList(DataTable table) {
        List actual = (List) read(SHOPPING_KEY)
        List expected = tableItems(table)
        assert actual.size() == expected.size() : "Expected ${expected}, got ${actual}"
        // Compare all persisted fields without requiring a particular display order.
        assert actual.every { item -> expected.count { it == item } == 1 } : "Expected ${expected}, got ${actual}"
        assert actual.collect { it.name.trim().toLowerCase(Locale.ROOT) }.unique().size() == actual.size()
    }

    @Then('the US-23 pantry is unchanged')
    void verifyPantry() {
        assert read(PANTRY_KEY) == pantry
    }

    @When('I open the US-23 shopping list page')
    void openShoppingPage() {
        WebUI.navigateToUrl(BASE_URL + 'shopping-list.html')
        WebUI.waitForElementVisible(xpath("//ul[@id='shopping-list-container']"), 10)
    }

    @When('I reload the US-23 shopping list page')
    void reloadShoppingPage() {
        WebUI.refresh()
        WebUI.waitForElementVisible(xpath("//ul[@id='shopping-list-container']"), 10)
    }

    @Then('the US-23 shopping page shows exactly {string}')
    void verifyShoppingPage(String names) {
        List rows = WebUI.findWebElements(xpath("//ul[@id='shopping-list-container']/li"), 5)
        List actualNames = rows.collect { it.getText().readLines().first().split(' - ', 2).last().trim() }
        assert actualNames.sort() == names.split(',').collect { it.trim() }.sort()
    }

    @Then('the US-23 card {string} shows nothing missing')
    void verifyNothingMissing(String title) {
        TestObject indicator = xpath(cardPath(title) + "//p[strong[contains(., 'Falta:')]]")
        WebUI.verifyElementVisible(indicator)
        assert WebUI.getText(indicator).contains('Nada!')
    }
}
