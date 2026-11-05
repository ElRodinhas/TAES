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

class BarcodeSteps {
	
	String baseUrl = "http://localhost:8000/scan.html"

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
		// Usa o WebDriverWait para esperar até o URL mudar para index.html
		try {
			WebDriverWait wait = new WebDriverWait(DriverFactory.getWebDriver(), Duration.ofSeconds(10))
			wait.until(ExpectedConditions.urlContains("index.html"))
		} catch (Exception e) {
			KeywordUtil.markFailed("O browser não redirecionou para o index.html a tempo.")
		}
		
		// Verificação final
		String currentUrl = WebUI.getUrl()
		WebUI.verifyMatch(currentUrl, ".*index\\.html", true)
		
		WebUI.closeBrowser()
	}
	
	@When("fills the required form fields")
	def fillsRequiredFormFields() {
		// Preenche a data de validade (formato YYYY-MM-DD)
		WebUI.setText(createTestObject("productExpiry"), "2026-12-31")
		
		// Garante que a quantidade está preenchida
		WebUI.setText(createTestObject("productQty"), "1")
	}
}