package smartpantry.steps

import static com.kms.katalon.core.testobject.ConditionType.EQUALS
import static com.kms.katalon.core.testobject.ConditionType.CONTAINS
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.webui.driver.DriverFactory
import com.kms.katalon.core.util.KeywordUtil
import com.kms.katalon.core.model.FailureHandling
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then
import org.openqa.selenium.By
import org.openqa.selenium.WebElement
import org.openqa.selenium.support.ui.WebDriverWait
import org.openqa.selenium.support.ui.ExpectedConditions
import java.time.Duration
import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import io.cucumber.java.After

class BarcodeSteps {
	
	String baseUrl = "http://localhost:8000/scan.html"
    private String inventoryBeforeBarcodeSave

	// ---------- HELPERS (Para criar objetos de teste facilmente) ----------
	
	private TestObject createTestObject(String id) {
		TestObject to = new TestObject(id)
		to.addProperty("id", ConditionType.EQUALS, id)
		return to
	}

	// ---------- STEPS ----------

	@Given("the user is on the scanner page")
	def userIsOnScannerPage() {
		WebUI.openBrowser('')
		WebUI.navigateToUrl(baseUrl)
		WebUI.executeJavaScript("localStorage.removeItem('smartPantry_inventory');", null)
		WebUI.maximizeWindow()
		
		// Garante que a caixa de texto manual está visível
		WebUI.waitForElementVisible(createTestObject("manualBarcode"), 10)
	}

	@When("the user scans a known barcode {string}")
	def userScansKnownBarcode(String barcode) {
		// Simula a leitura usando a caixa de texto manual
		WebUI.setText(createTestObject("manualBarcode"), barcode)
		WebUI.click(createTestObject("lookupBarcodeBtn"))
		
		// Espera que o formulário (onde estão os resultados) apareça
		WebUI.waitForElementVisible(createTestObject("formContainer"), 10)
		
		WebDriverWait wait = new WebDriverWait(DriverFactory.getWebDriver(), Duration.ofSeconds(15))
		wait.until(ExpectedConditions.not(ExpectedConditions.attributeToBe(
			By.id("productName"), "value", "A procurar produto..."
		)))
	}

	@When("the user scans an unlisted barcode {string}")
	def userScansUnlistedBarcode(String barcode) {
		WebUI.setText(createTestObject("manualBarcode"), barcode)
		WebUI.click(createTestObject("lookupBarcodeBtn"))
		
		// Esperar que a mensagem de erro apareça
		WebUI.waitForElementVisible(createTestObject("scanner-msg"), 10)
		
		// Esperar que a API termine de procurar (o campo deixa de dizer "A procurar...")
		WebDriverWait wait = new WebDriverWait(DriverFactory.getWebDriver(), Duration.ofSeconds(15))
		wait.until(ExpectedConditions.not(ExpectedConditions.attributeToBe(
			By.id("productName"), "value", "A procurar produto..."
		)))
	}

	@When("edits the item name to {string}")
	def editsItemName(String newName) {
		WebUI.clearText(createTestObject("productName"))
		WebUI.setText(createTestObject("productName"), newName)
	}

	@When("clicks the save button")
	def clicksSaveButton() {
		// Clica em guardar
		WebUI.click(createTestObject("btn-save-item"))
	}

	@Then("the item form should be auto-filled with product details")
	def itemFormIsAutoFilled() {
		String productName = WebUI.getAttribute(createTestObject("productName"), 'value')
		String productCategory = WebUI.getAttribute(createTestObject("productCategory"), 'value')
		
		// Verifica se os campos foram preenchidos
		WebUI.verifyNotEqual(productName, null)
		WebUI.verifyNotEqual(productName, "")
		WebUI.verifyNotEqual(productCategory, null)
		WebUI.verifyNotEqual(productCategory, "")
		
		WebUI.takeScreenshot("AutoFill_Success.png")
		WebUI.closeBrowser()
	}

	@Then("the form should open for manual entry with empty product details")
	def formIsOpenForManualEntry() {
		WebUI.verifyElementVisible(createTestObject("formContainer"))
		
		String productName = WebUI.getAttribute(createTestObject("productName"), 'value')
		
		WebUI.verifyEqual(productName.isEmpty() || productName == "", true, FailureHandling.CONTINUE_ON_FAILURE)
		
		// A mensagem de produto não encontrado deve estar visível
		WebUI.verifyElementVisible(createTestObject("scanner-msg"))
		
		WebUI.closeBrowser()
	}

	@Then("the item should be saved with the updated details")
	def itemIsSavedWithUpdatedDetails() {
		// Espera pelo destino real de um produto guardado.
		try {
			WebDriverWait wait = new WebDriverWait(DriverFactory.getWebDriver(), Duration.ofSeconds(10))
			wait.until(ExpectedConditions.urlContains("/pantry.html"))
		} catch (Exception e) {
			KeywordUtil.markFailedAndStop("O browser não redirecionou para o pantry.html a tempo.")
		}
		
		String currentUrl = WebUI.getUrl()
		WebUI.verifyMatch(currentUrl, ".*pantry\\.html", true)
        def inventory = new JsonSlurper().parseText(readBarcodeInventory())
        WebUI.verifyEqual(inventory.any { it.name == 'Produto Editado Teste' }, true)
		
		WebUI.closeBrowser()
	}
	
	@When("fills the required form fields")
	def fillsRequiredFormFields() {
		// Preenche a data de validade (formato YYYY-MM-DD)
		WebUI.setText(createTestObject("productExpiry"), "2026-12-31")
		
		// Garante que a quantidade está preenchida
		WebUI.setText(createTestObject("productQty"), "1")
	}

    private TestObject barcodeField(String testId) {
        TestObject field = new TestObject(testId)
        field.addProperty('css', ConditionType.EQUALS, "[data-testid='${testId}']")
        return field
    }

    private String readBarcodeInventory() {
        return (String) WebUI.executeJavaScript(
            "return localStorage.getItem('smartPantry_inventory');", null
        )
    }

    @Given('the pantry contains Arroz with barcode {string}')
    def seedBarcodeInventory(String barcode) {
        def inventory = [[
            id: 'barcode-test-product', name: 'Arroz', barcode: barcode,
            category: 'Geral', quantity: 1, expiry: null
        ]]
        WebUI.executeJavaScript(
            "localStorage.setItem('smartPantry_inventory', arguments[0]);",
            [JsonOutput.toJson(inventory)]
        )
        inventoryBeforeBarcodeSave = readBarcodeInventory()

        // Open manual entry without calling the external product lookup API.
        WebUI.executeJavaScript(
            "document.getElementById('formContainer').style.display = 'block';", null
        )
        WebUI.waitForElementVisible(barcodeField('input-item-name'), 10)
    }

    @When('I manually submit product {string} with barcode {string}')
    def submitManualBarcodeProduct(String name, String barcode) {
        WebUI.setText(barcodeField('input-item-name'), name)
        if (barcode.isEmpty()) {
            WebUI.clearText(barcodeField('barcode-input'))
        } else {
            WebUI.setText(barcodeField('barcode-input'), barcode)
        }
        WebUI.setText(barcodeField('input-item-category'), 'Geral')
        WebUI.setText(barcodeField('input-item-qty'), '2')
        WebUI.click(barcodeField('btn-save-item'))
    }

    @Then('the duplicate barcode error should be displayed')
    def verifyDuplicateBarcodeError() {
        TestObject message = createTestObject('form-msg')
        WebUI.waitForElementVisible(message, 5)
        WebUI.verifyEqual(WebUI.getAttribute(message, 'class'), 'error')
        WebUI.verifyEqual(WebUI.getText(message),
            'Erro: Este código de barras já está associado a outro produto.')
        WebUI.verifyEqual(WebUI.executeJavaScript(
            'return document.activeElement.id;', null
        ), 'barcodeVal')
    }

    @Then('the pantry inventory should remain unchanged')
    def verifyBarcodeInventoryUnchanged() {
        WebUI.verifyEqual(readBarcodeInventory(), inventoryBeforeBarcodeSave)
    }

    @Then('the pantry should contain {int} products')
    def verifyBarcodeInventoryCount(int count) {
        WebDriverWait wait = new WebDriverWait(
            DriverFactory.getWebDriver(), Duration.ofSeconds(10)
        )
        wait.until(ExpectedConditions.urlContains('/pantry.html'))
        def inventory = new JsonSlurper().parseText(readBarcodeInventory())
        WebUI.verifyEqual(inventory.size(), count)
    }

    @Then('pantry product {string} should have barcode {string} and quantity {int}')
    def verifySavedBarcodeProduct(String name, String barcode, int quantity) {
        def inventory = new JsonSlurper().parseText(readBarcodeInventory())
        def matches = inventory.findAll { it.name.equalsIgnoreCase(name) }
        WebUI.verifyEqual(matches.size(), 1)
        def product = matches.first()
        WebUI.verifyEqual(product.barcode, barcode.isEmpty() ? null : barcode)
        WebUI.verifyEqual(product.quantity.toString(), quantity.toString())
    }

    @After('@barcode-uniqueness')
    void closeBarcodeUniquenessBrowser() {
        WebUI.closeBrowser()
    }
}
