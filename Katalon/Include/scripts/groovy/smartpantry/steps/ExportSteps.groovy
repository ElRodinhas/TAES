package smartpantry.steps

import io.cucumber.java.Before
import io.cucumber.java.After
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then
import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.webui.driver.DriverFactory
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.testobject.ConditionType
import org.openqa.selenium.JavascriptExecutor

class ExportSteps {
    private static final String PROFILE_KEY = 'smartPantry.households.v1'
    private static final String PANTRY_KEY = 'smartPantry_inventory'
    private Map originalData
    private final Map profiles = [version: 1, activeHouseholdId: 'guests', households: [
        [id: 'family', name: 'Família', servings: 4, lifestyle: 'omnivore', allergies: [], excludedIngredients: []],
        [id: 'guests', name: 'Guests', servings: 2, lifestyle: 'vegan', allergies: ['Soy'], excludedIngredients: ['garlic']]
    ]]
    private final List pantry = [[id: 'rice', name: 'Rice', quantity: 2, barcode: '0012345678905', category: 'Grains', expiry: '2027-01-01']]

    private TestObject byTestId(String id) {
        TestObject object = new TestObject(id)
        object.addProperty('css', ConditionType.EQUALS, "[data-testid='${id}']")
        return object
    }

    private Map storedData() {
        return (Map) WebUI.executeJavaScript('return Object.fromEntries(Object.entries(localStorage))', null)
    }

    @Before('@export-application-state')
    void openExportBrowser() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl('http://localhost:8000/')
        // Reset only the dedicated local test origin.
        WebUI.executeJavaScript('localStorage.clear()', null)
    }

    @After('@export-application-state')
    void closeExportBrowser() {
        WebUI.closeBrowser()
    }

    @Given('the export page has saved profiles and pantry stock')
    void seedExportData() {
        WebUI.executeJavaScript('''
            localStorage.setItem(arguments[0], arguments[1]);
            localStorage.setItem(arguments[2], arguments[3]);
            localStorage.setItem('test.unrelated', 'must not be exported');
        ''', [PROFILE_KEY, JsonOutput.toJson(profiles), PANTRY_KEY, JsonOutput.toJson(pantry)])
        WebUI.refresh()
        originalData = storedData()
    }

    @Given('the export page has no saved data')
    void emptyExportData() {
        WebUI.refresh()
        originalData = storedData()
    }

    @Given('export storage is {string}')
    void failExportStorage(String failure) {
        if (failure == 'invalid JSON') {
            WebUI.executeJavaScript('localStorage.setItem(arguments[0], "{broken")', [PANTRY_KEY])
            originalData = storedData()
        } else {
            assert failure == 'unavailable'
            WebUI.executeJavaScript("Storage.prototype.getItem = function() { throw new Error('Storage blocked'); }", null)
        }
    }

    @When('I request a JSON data export')
    void exportData() {
        // Capture the exact download Blob and anchor instead of depending on OS download folders.
        WebUI.executeJavaScript('''
            window.exportDownload = null;
            const createURL = URL.createObjectURL.bind(URL);
            URL.createObjectURL = function(blob) { window.exportBlob = blob; return createURL(blob); };
            HTMLAnchorElement.prototype.click = function() {
                window.exportDownload = {filename: this.download, href: this.href};
            };
        ''', null)
        WebUI.waitForElementClickable(byTestId('export-data'), 10)
        WebUI.click(byTestId('export-data'))
    }

    private Map downloadedSnapshot() {
        Map download = (Map) WebUI.executeJavaScript('return window.exportDownload', null)
        assert download != null
        assert download.filename ==~ /smartpantry-backup-.*\.json/
        assert download.href.startsWith('blob:')
        assert WebUI.executeJavaScript('return window.exportBlob.type', null) == 'application/json'
        String json = (String) ((JavascriptExecutor) DriverFactory.getWebDriver()).executeAsyncScript('''
            const done = arguments[arguments.length - 1];
            window.exportBlob.text().then(done, () => done(''));
        ''')
        Map snapshot = (Map) new JsonSlurper().parseText(json)
        assert snapshot.application == 'SmartPantry'
        assert snapshot.schemaVersion == 1
        assert java.time.Instant.parse(snapshot.exportedAt) != null
        WebUI.verifyElementText(byTestId('export-status'), 'Export file prepared. Check your browser downloads.')
        return snapshot
    }

    @Then('the JSON download contains all saved profiles and pantry stock')
    void verifyPopulatedExport() {
        assert downloadedSnapshot().data == [profiles: profiles, pantryStock: pantry]
    }

    @Then('the JSON download contains empty profiles and pantry stock')
    void verifyEmptyExport() {
        assert downloadedSnapshot().data == [profiles: [version: 1, households: [], activeHouseholdId: null], pantryStock: []]
    }

    @Then('an export error appears without a download')
    void verifyExportError() {
        WebUI.waitForElementVisible(byTestId('export-error'), 10)
        assert WebUI.executeJavaScript('return window.exportDownload', null) == null
        WebUI.verifyElementText(byTestId('export-status'), '')
    }

    @Then('exporting leaves device storage unchanged')
    void verifyStorageUnchanged() {
        assert storedData() == originalData
    }
}
