package smartpantry.steps

import io.cucumber.java.Before
import io.cucumber.java.After
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then
import groovy.json.JsonOutput
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.testobject.ConditionType

class SwitchProfileSteps {
    private static final String KEY = 'smartPantry.households.v1'
    private Map originalData
    private String originalProfiles
    private final List profiles = [
        [id: 'family', name: 'Family', servings: 4, lifestyle: 'omnivore', allergies: [], excludedIngredients: []],
        [id: 'guests', name: 'Guests', servings: 2, lifestyle: 'vegan', allergies: ['Peanuts'], excludedIngredients: ['mushrooms']]
    ]

    private TestObject byTestId(String id) {
        TestObject object = new TestObject(id)
        object.addProperty('css', ConditionType.EQUALS, "[data-testid='${id}']")
        return object
    }

    @Before('@switch-active-profile')
    void openBrowser() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl('http://localhost:8000/')
        // Only this dedicated local test origin is reset.
        WebUI.executeJavaScript('localStorage.clear()', null)
    }

    @After('@switch-active-profile')
    void closeBrowser() {
        WebUI.closeBrowser()
    }

    private void seedProfiles(List households) {
        String state = JsonOutput.toJson([version: 1, households: households, activeHouseholdId: households ? 'family' : null])
        WebUI.executeJavaScript('localStorage.setItem(arguments[0], arguments[1])', [KEY, state])
        WebUI.refresh()
    }

    @Given('the profile dashboard has two saved profiles and shared device data')
    void twoProfiles() {
        // The sentinel is unrelated data, not an invented shopping-list schema.
        WebUI.executeJavaScript("localStorage.setItem('smartPantry_inventory', '[{\"id\":\"rice\",\"name\":\"Rice\",\"quantity\":2}]'); localStorage.setItem('test.shared-data', 'preserve me');", null)
        seedProfiles(profiles)
        originalData = (Map) WebUI.executeJavaScript("return Object.fromEntries(Object.entries(localStorage).filter(([key]) => key !== arguments[0]))", [KEY])
        originalProfiles = (String) WebUI.executeJavaScript('return JSON.stringify(JSON.parse(localStorage.getItem(arguments[0])).households)', [KEY])
        WebUI.waitForElementVisible(byTestId('profile-switcher'), 10)
    }

    @Given('the profile dashboard has no saved profiles')
    void noProfiles() {
        WebUI.refresh()
        WebUI.waitForElementVisible(byTestId('onboarding-screen'), 10)
    }

    @Given('the profile dashboard has only one saved profile')
    void oneProfile() {
        seedProfiles([profiles[0]])
        WebUI.waitForElementVisible(byTestId('profile-switcher'), 10)
    }

    @Given('profile switching cannot write to device storage')
    void blockWrites() {
        WebUI.executeJavaScript("Storage.prototype.setItem = function() { throw new DOMException('Storage blocked', 'QuotaExceededError'); }", null)
    }

    @When('I choose {string} in the dashboard header')
    void chooseProfile(String name) {
        WebUI.selectOptionByLabel(byTestId('active-profile'), name, false)
    }

    @Then('the dashboard header and active card show {string}')
    void verifyProfile(String name) {
        WebUI.waitForElementVisible(byTestId('profile-switcher'), 10)
        WebUI.verifyOptionSelectedByLabel(byTestId('active-profile'), name, false, 10)
        WebUI.verifyElementText(byTestId('active-household-name'), name)
    }

    @Then('the saved active profile is {string}')
    void verifySavedProfile(String id) {
        assert WebUI.executeJavaScript('return JSON.parse(localStorage.getItem(arguments[0])).activeHouseholdId', [KEY]) == id
    }

    @Then('shared device data and saved profile preferences are unchanged')
    void verifySharedData() {
        assert WebUI.executeJavaScript("return Object.fromEntries(Object.entries(localStorage).filter(([key]) => key !== arguments[0]))", [KEY]) == originalData
        assert WebUI.executeJavaScript('return JSON.stringify(JSON.parse(localStorage.getItem(arguments[0])).households)', [KEY]) == originalProfiles
    }

    @Then('a profile switching storage error is visible')
    void verifyError() {
        WebUI.verifyElementVisible(byTestId('profile-switch-error'))
        WebUI.verifyElementText(byTestId('profile-switch-error'), 'Could not switch profiles on this device. Please try again.')
    }

    @Then('the dashboard profile switcher is hidden')
    void verifyHidden() {
        WebUI.verifyElementNotVisible(byTestId('profile-switcher'))
    }

    @Then('the dashboard header offers one profile')
    void verifyOneOption() {
        assert WebUI.executeJavaScript('return document.getElementById("active-profile").options.length', null) == 1
    }
    @When('I visit the {string} app page')
    void visitPage(String page) {
        assert page in ['index.html', 'pantry.html', 'scan.html']
        WebUI.navigateToUrl('http://localhost:8000/' + page)
        WebUI.waitForElementVisible(byTestId('profile-switcher'), 10)
    }

    @Then('the page header shows profile {string}')
    void verifyPageHeader(String name) {
        WebUI.waitForElementVisible(byTestId('profile-switcher'), 10)
        WebUI.verifyOptionSelectedByLabel(byTestId('active-profile'), name, false, 10)
    }
}
