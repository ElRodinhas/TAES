package smartpantry.steps

import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import io.cucumber.java.After
import io.cucumber.java.Before
import io.cucumber.java.en.Given
import io.cucumber.java.en.Then
import io.cucumber.java.en.When

class ExpiryAlertsSteps {
    private static final String BASE_URL = 'http://localhost:8000/'

    private TestObject byCss(String selector) {
        TestObject object = new TestObject(selector)
        object.addProperty('css', ConditionType.EQUALS, selector)
        return object
    }

    private TestObject alertTray() {
        // Expected UI contract for US-06; intentionally absent until implementation.
        return byCss('[data-testid="expiry-alert-tray"]')
    }

    @Before('@expiry-alerts')
    void openExpiryAlertsBrowser() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(BASE_URL)
        // Only reset data for this browser's local test origin.
        WebUI.executeJavaScript('localStorage.clear()', null)
    }

    @After('@expiry-alerts')
    void closeExpiryAlertsBrowser() {
        WebUI.closeBrowser()
    }

    @Given('the expiry alerts pantry contains {string} expiring in {int} hours and {string} expiring in 5 days')
    void seedExpiryItems(String nearItem, int hours, String distantItem) {
        assert hours in [24, 48] : 'Date-only fixtures support 24 and 48 hours.'
        WebUI.executeJavaScript('''
            const today = new Date();
            function expiryInDays(days) {
                const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
                return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
                    String(date.getDate()).padStart(2, '0')].join('-');
            }
            localStorage.setItem('smartPantry.households.v1', JSON.stringify({
                version: 1, activeHouseholdId: 'expiry-household', households: [{
                    id: 'expiry-household', name: 'Expiry test household', servings: 2,
                    lifestyle: 'omnivore', allergies: [], excludedIngredients: []
                }]
            }));
            localStorage.setItem('smartPantry_inventory', JSON.stringify([
                {id: 'expiry-soon', name: arguments[0], category: 'Dairy', quantity: 1,
                    barcode: null, expiry: expiryInDays(arguments[1] / 24)},
                {id: 'expiry-5d', name: arguments[2], category: 'Grains', quantity: 1,
                    barcode: null, expiry: expiryInDays(5)}
            ]));
        ''', [nearItem, hours, distantItem])
    }

    @When('I open the pantry to check expiry alerts')
    void openPantryForExpiryAlerts() {
        WebUI.navigateToUrl(BASE_URL + 'pantry.html')
        WebUI.verifyEqual(WebUI.waitForElementVisible(byCss('[data-testid="pantry-screen"]'), 10), true)
        verifyInventoryItems()
    }

    @Then('the expiry alert tray is visible')
    void verifyAlertTrayVisible() {
        WebUI.verifyEqual(WebUI.waitForElementVisible(alertTray(), 10), true)
    }

    @Then('{string} appears in the expiry alert tray')
    void verifyItemInAlertTray(String name) {
        WebUI.verifyElementVisible(alertTray())
        WebUI.verifyEqual(WebUI.getText(alertTray()).contains(name), true)
    }

    @Then('{string} does not appear in the expiry alert tray')
    void verifyItemOutsideAlertTray(String name) {
        // A missing tray must fail rather than count as a successful exclusion.
        WebUI.verifyElementVisible(alertTray())
        WebUI.verifyEqual(WebUI.getText(alertTray()).contains(name), false)
    }

    @Then('both expiry test items remain visible in the pantry inventory')
    void verifyInventoryItems() {
        for (String id : ['expiry-soon', 'expiry-5d']) {
            WebUI.verifyEqual(WebUI.waitForElementVisible(
                byCss('#pantry-list .pantry-item[data-id="' + id + '"]'), 10), true)
        }
    }

    @Then('the soon-expiring pantry item has a visible expiry highlight')
    void verifyExpiryHighlight() {
        // Expected US-06 contract: a visible warning inside the inventory card.
        TestObject warning = byCss('#pantry-list .pantry-item[data-id="expiry-soon"] [data-testid="expiry-warning"]')
        WebUI.verifyEqual(WebUI.waitForElementVisible(warning, 10), true)
        WebUI.verifyNotEqual(WebUI.getText(warning).trim(), '')
        // Check a visual distinction, allowing either the card or its warning to be styled.
        WebUI.verifyEqual(WebUI.executeJavaScript('''
            const soon = document.querySelector('#pantry-list .pantry-item[data-id="expiry-soon"]');
            const distant = document.querySelector('#pantry-list .pantry-item[data-id="expiry-5d"]');
            const warning = soon.querySelector('[data-testid="expiry-warning"]');
            const cardStyle = getComputedStyle(soon);
            const normalStyle = getComputedStyle(distant);
            const warningStyle = getComputedStyle(warning);
            return cardStyle.backgroundColor !== normalStyle.backgroundColor ||
                cardStyle.color !== normalStyle.color ||
                cardStyle.borderColor !== normalStyle.borderColor ||
                warningStyle.color !== cardStyle.color ||
                (warningStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                    warningStyle.backgroundColor !== cardStyle.backgroundColor);
        ''', null), true)
    }

    @Then('the pantry item expiring in 5 days has no expiry highlight')
    void verifyNoExpiryHighlight() {
        WebUI.verifyElementVisible(byCss('#pantry-list .pantry-item[data-id="expiry-5d"]'))
        WebUI.verifyElementNotPresent(
            byCss('#pantry-list .pantry-item[data-id="expiry-5d"] [data-testid="expiry-warning"]'), 5)
    }
}
