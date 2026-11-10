package smartpantry.steps

import io.cucumber.java.Before
import io.cucumber.java.After
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.testobject.ConditionType

/**
 * Executable step definitions for InitialHouseholdSetup.feature.
 * Uses Katalon 11+ (Cucumber 7) imports.
 * Requires the local Smart Pantry web server on port 8000.
 */
class HouseholdSteps {
    private static final String BASE_URL = 'http://localhost:8000/'
    private static final String STORAGE_KEY = 'smartPantry.households.v1'

    private TestObject byTestId(String value) {
        TestObject object = new TestObject(value)
        object.addProperty('css', ConditionType.EQUALS, "[data-testid='${value}']")
        return object
    }

    private void saveHousehold(String name, String servings) {
        WebUI.waitForElementVisible(byTestId('onboarding-screen'), 10)
        WebUI.setText(byTestId('household-name'), name)
        WebUI.setText(byTestId('serving-count'), servings)
        WebUI.click(byTestId('save-household'))
        WebUI.waitForElementVisible(byTestId('households-screen'), 10)
    }

    // Each scenario starts independently with an empty browser household profile.
    @Before('@initial-household-setup')
    void openCleanBrowser() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(BASE_URL)
        WebUI.executeJavaScript("window.localStorage.removeItem('${STORAGE_KEY}')", null)
        WebUI.refresh()
    }

    @After('@initial-household-setup')
    void closeBrowser() {
        WebUI.closeBrowser()
    }

    @Given('I open Smart Pantry with no saved households')
    void freshStart() {
        WebUI.waitForElementVisible(byTestId('onboarding-screen'), 10)
    }

    @Given('the onboarding screen is visible')
    void onboardingGivenVisible() {
        WebUI.verifyElementVisible(byTestId('onboarding-screen'))
    }

    @Then('the onboarding screen should be visible')
    void onboardingThenVisible() {
        WebUI.verifyElementVisible(byTestId('onboarding-screen'))
    }

    @When('I enter {string} as the household name')
    void enterHouseholdName(String name) {
        WebUI.setText(byTestId('household-name'), name)
    }

    @When('I enter {string} as the serving count')
    void enterServingCount(String count) {
        WebUI.setText(byTestId('serving-count'), count)
    }

    @When('I select {string} as the dietary lifestyle')
    void selectLifestyle(String lifestyle) {
        WebUI.selectOptionByValue(byTestId('dietary-lifestyle'), lifestyle, false)
    }

    @When('I select {string} as a food allergy')
    void selectAllergy(String allergy) {
        String testId = 'allergy-' + allergy.toLowerCase().replace(' ', '-')
        WebUI.check(byTestId(testId))
    }

    @When('I enter {string} as excluded ingredients')
    void enterExcludedIngredients(String ingredients) {
        WebUI.setText(byTestId('excluded-ingredients'), ingredients)
    }

    @When('I save the household profile')
    void submitValidHousehold() {
        WebUI.click(byTestId('save-household'))
    }

    @When('I attempt to save the household profile')
    void submitInvalidHousehold() {
        WebUI.click(byTestId('save-household'))
    }

    @Then('the household management screen should be visible')
    void managementScreenVisible() {
        WebUI.waitForElementVisible(byTestId('households-screen'), 10)
    }

    @Then('the active household should be named {string}')
    void verifyActiveHousehold(String name) {
        WebUI.verifyElementText(byTestId('active-household-name'), name)
    }

    @Then('the active household summary should be {string}')
    void verifyActiveSummary(String summary) {
        WebUI.verifyElementText(byTestId('active-household-summary'), summary)
    }

    @Then('the household card should list allergy {string} and excluded ingredients {string}')
    void verifyPreferences(String allergy, String ingredients) {
        WebUI.verifyTextPresent("Allergies: ${allergy}", false)
        WebUI.verifyTextPresent("Avoid: ${ingredients}", false)
    }

    @Given('I have saved a household named {string} with {int} servings')
    void existingHousehold(String name, int count) {
        saveHousehold(name, count.toString())
    }

    @When('I reload the Smart Pantry application')
    void reloadApp() {
        WebUI.refresh()
    }

    @Then('the onboarding screen should not be visible')
    void onboardingNotVisible() {
        WebUI.verifyElementNotVisible(byTestId('onboarding-screen'))
    }

    @When('I leave the serving count empty')
    void blankServings() {
        WebUI.clearText(byTestId('serving-count'))
    }

    @Then('I should see the serving count error {string}')
    void checkServingError(String message) {
        WebUI.verifyElementText(byTestId('servings-error'), message)
    }

    @Then('no household profile should be stored')
    void nothingSaved() {
        Object stored = WebUI.executeJavaScript("return window.localStorage.getItem('${STORAGE_KEY}')", null)
        assert stored == null : 'Invalid onboarding must not be persisted in localStorage'
    }

    @When('I add a household named {string} with {int} servings')
    void addAnotherHousehold(String name, int count) {
        WebUI.click(byTestId('add-household'))
        saveHousehold(name, count.toString())
    }

    @Then('I should see {int} household cards')
    void verifyHouseholdCount(int expected) {
        assert WebUI.findWebElements(byTestId('household-card'), 10).size() == expected
    }
}
