package smartpantry.steps

import io.cucumber.java.Before
import io.cucumber.java.After
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then
import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import java.nio.file.Files
import java.nio.file.Path
import java.nio.charset.StandardCharsets
import org.openqa.selenium.By
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.webui.driver.DriverFactory
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.testobject.ConditionType

class ImportSteps {
    private static final String PROFILE_KEY = 'smartPantry.households.v1'
    private static final String PANTRY_KEY = 'smartPantry_inventory'
    private final List<Path> files = []
    private Map originalData

    private Map backup() {
        return [application: 'SmartPantry', schemaVersion: 1, exportedAt: '2026-11-13T12:00:00.000Z', data: [
            profiles: [version: 1, activeHouseholdId: 'guests', households: [
                [id: 'family', name: 'Family', servings: 4, lifestyle: 'omnivore', allergies: [], excludedIngredients: []],
                [id: 'guests', name: 'Guests', servings: 2, lifestyle: 'vegan', allergies: ['Soy'], excludedIngredients: ['garlic']]
            ]],
            pantryStock: [[id: 'rice', name: 'Rice', category: 'Grains', quantity: '2', barcode: '012345678905', expiry: '2027-01-01']]
        ]]
    }

    private TestObject byTestId(String id) {
        TestObject object = new TestObject(id)
        object.addProperty('css', ConditionType.EQUALS, "[data-testid='${id}']")
        return object
    }

    private Map storedData() {
        return (Map) WebUI.executeJavaScript('return Object.fromEntries(Object.entries(localStorage))', null)
    }

    @Before('@import-application-state')
    void openImportBrowser() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl('http://localhost:8000/')
        WebUI.executeJavaScript('localStorage.clear()', null)
    }

    @After('@import-application-state')
    void closeImportBrowser() {
        try {
            WebUI.closeBrowser()
        } finally {
            for (Path file : files) Files.deleteIfExists(file)
        }
    }

    @Given('the import page has {string} device data')
    void seedImportPage(String state) {
        assert state in ['existing', 'empty']
        if (state == 'existing') {
            Map oldProfiles = [version: 1, activeHouseholdId: 'old', households: [
                [id: 'old', name: 'Old household', servings: 1, lifestyle: 'omnivore', allergies: [], excludedIngredients: []]
            ]]
            WebUI.executeJavaScript('localStorage.setItem(arguments[0], arguments[1]); localStorage.setItem(arguments[2], "[]")',
                [PROFILE_KEY, JsonOutput.toJson(oldProfiles), PANTRY_KEY])
        }
        WebUI.executeJavaScript("localStorage.setItem('test.unrelated', 'preserve me')", null)
        WebUI.refresh()
        originalData = storedData()
        WebUI.waitForElementClickable(byTestId('import-data'), 10)
    }

    private void selectFile(String content) {
        Path file = Files.createTempFile('smartpantry-import-', '.json')
        files.add(file)
        Files.write(file, content.getBytes(StandardCharsets.UTF_8))
        // Selenium sends a real file to the input; the browser reads it with File.text().
        DriverFactory.getWebDriver().findElement(By.cssSelector('[data-testid="import-file"]')).sendKeys(file.toAbsolutePath().toString())
    }

    @When('I select a valid exported JSON file and confirm replacement')
    void confirmImport() {
        selectFile(JsonOutput.toJson(backup()))
        assert WebUI.waitForAlert(10)
        WebUI.acceptAlert()
    }

    @When('I select a valid exported JSON file and cancel replacement')
    void cancelImport() {
        selectFile(JsonOutput.toJson(backup()))
        assert WebUI.waitForAlert(10)
        WebUI.dismissAlert()
        WebUI.waitForElementVisible(byTestId('import-status'), 10)
        WebUI.verifyElementText(byTestId('import-status'), 'Import cancelled. Your saved data is unchanged.')
    }

    @When('I select an import file with {string}')
    void invalidImport(String problem) {
        Map snapshot = backup()
        switch (problem) {
            case 'invalid JSON': selectFile('{broken'); return
            case 'unsupported version': snapshot.schemaVersion = 2; break
            case 'missing section': snapshot.data.remove('pantryStock'); break
            case 'invalid profile': snapshot.data.profiles.households[0].servings = 0; break
            case 'invalid pantry item': snapshot.data.pantryStock[0].quantity = -1; break
            default: throw new IllegalArgumentException(problem)
        }
        selectFile(JsonOutput.toJson(snapshot))
    }

    @Given('importing pantry stock cannot write to device storage')
    void blockPantryWrite() {
        WebUI.executeJavaScript('''
            const set = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'smartPantry_inventory') throw new DOMException('Storage full', 'QuotaExceededError');
                return set.call(this, key, value);
            };
        ''', null)
    }

    @Then('the imported profiles and pantry stock replace the saved data')
    void verifyRestoredData() {
        // This element becomes visible only after the newly imported profile is rendered.
        TestObject guests = new TestObject('imported-profile')
        guests.addProperty('xpath', ConditionType.EQUALS, "//*[@data-testid='active-household-name' and text()='Guests']")
        assert WebUI.waitForElementVisible(guests, 10)
        Map stored = storedData()
        assert new JsonSlurper().parseText(stored[PROFILE_KEY]) == backup().data.profiles
        assert new JsonSlurper().parseText(stored[PANTRY_KEY]) == backup().data.pantryStock
    }

    @Then('the imported active profile is shown after reload')
    void verifyImportedProfile() {
        WebUI.verifyElementText(byTestId('active-household-name'), 'Guests')
        WebUI.verifyOptionSelectedByLabel(byTestId('active-profile'), 'Guests', false, 10)
        WebUI.refresh()
        WebUI.waitForElementVisible(byTestId('active-household-name'), 10)
        WebUI.verifyElementText(byTestId('active-household-name'), 'Guests')
    }

    @Then('unrelated device data is preserved by import')
    void verifyUnrelatedData() {
        assert storedData()['test.unrelated'] == originalData['test.unrelated']
    }

    @Then('importing leaves device storage unchanged')
    void verifyUnchangedData() {
        assert storedData() == originalData
    }

    @Then('an import error is visible')
    void verifyImportError() {
        assert WebUI.waitForElementVisible(byTestId('import-error'), 10)
    }
}
