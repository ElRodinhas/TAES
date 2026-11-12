package smartpantry.steps

import static com.kms.katalon.core.testobject.ConditionType.EQUALS
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.webui.driver.DriverFactory
import com.kms.katalon.core.util.KeywordUtil
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then
import org.openqa.selenium.By
import org.openqa.selenium.JavascriptExecutor
import org.openqa.selenium.support.ui.WebDriverWait
import org.openqa.selenium.support.ui.ExpectedConditions
import java.time.Duration

class RecipesSteps {
	
	String baseUrl = "http://localhost:8000/recipes.html"

	private TestObject createTestObject(String id) {
		TestObject to = new TestObject(id)
		to.addProperty("id", ConditionType.EQUALS, id)
		return to
	}

	@Given("the user is on the recipes page")
	def userIsOnRecipesPage() {
		WebUI.openBrowser('')
		WebUI.navigateToUrl(baseUrl)
		WebUI.maximizeWindow()
		WebUI.waitForElementVisible(createTestObject("btn-fetch-recipes"), 10)
	}

	@Given("the user has products in the pantry")
	def userHasProductsInPantry() {
		JavascriptExecutor js = (JavascriptExecutor) DriverFactory.getWebDriver()
		String script = """
			localStorage.setItem('smartPantry_inventory', JSON.stringify([
				{ name: 'tomato', quantity: 2, expiry: '2026-12-31' },
				{ name: 'chicken', quantity: 1, expiry: '2026-12-31' }
			]));
		"""
		js.executeScript(script)
		WebUI.refresh()
		WebUI.waitForElementVisible(createTestObject("btn-fetch-recipes"), 10)
	}

	@Given("the user has an empty pantry")
	def userHasEmptyPantry() {
		JavascriptExecutor js = (JavascriptExecutor) DriverFactory.getWebDriver()
		js.executeScript("window.localStorage.clear();")
		WebUI.refresh()
		WebUI.waitForElementVisible(createTestObject("btn-fetch-recipes"), 10)
	}

	@When("the user clicks the search recipes button")
	def userClicksSearchButton() {
		WebUI.click(createTestObject("btn-fetch-recipes"))
	}

	@Then("the system should display recipe cards")
	def systemDisplaysRecipeCards() {
		// Espera que o loading desapareça
		WebDriverWait wait = new WebDriverWait(DriverFactory.getWebDriver(), Duration.ofSeconds(15))
		wait.until(ExpectedConditions.invisibilityOfElementLocated(By.id("loading-recipes")))
		
		// Verifica se o contador de receitas não está a 0
		String recipeCount = WebUI.getText(createTestObject("recipe-count"))
		WebUI.verifyNotEqual(recipeCount, "0", com.kms.katalon.core.model.FailureHandling.STOP_ON_FAILURE)
	}

	@Then("the recipe cards should show the progress bar")
	def recipeCardsShowProgressBar() {
		// O ID 'overlap-value' está no span que tem a percentagem
		boolean isVisible = WebUI.waitForElementVisible(createTestObject("overlap-value"), 5)
		
		if (!isVisible) {
			KeywordUtil.markFailed("A percentagem de overlap não está visível nos cartões.")
		}
	}

	@Then("the system should display an empty state message")
	def systemDisplaysEmptyState() {
		WebUI.waitForElementVisible(createTestObject("recipe-msg"), 10)
		String msg = WebUI.getText(createTestObject("recipe-msg"))
		WebUI.verifyMatch(msg, ".*despensa está vazia.*", true)
		WebUI.closeBrowser()
	}
	
	@Given("the user has a product expiring soon in the pantry")
	def userHasExpiringProduct() {
		JavascriptExecutor js = (JavascriptExecutor) DriverFactory.getWebDriver()
		
		// Vamos calcular uma data que expira daqui a 2 dias (para garantir que está no limite de "quase a expirar")
		Calendar cal = Calendar.getInstance();
		cal.add(Calendar.DAY_OF_MONTH, 2);
		String dataFormatada = new java.text.SimpleDateFormat("yyyy-MM-dd").format(cal.getTime());
		
		// Injetamos um ingrediente (tomate) com essa data
		String script = """
			localStorage.setItem('smartPantry_inventory', JSON.stringify([
				{ name: 'tomato', quantity: 2, expiry: '${dataFormatada}' },
				{ name: 'chicken', quantity: 1, expiry: '2026-12-31' }
			]));
		"""
		js.executeScript(script)
		WebUI.refresh()
		WebUI.waitForElementVisible(createTestObject("btn-fetch-recipes"), 10)
	}

		@Then("the first recipe card should show the expiry warning")
	def firstCardShowsExpiryWarning() {
		// Espera o loading terminar
		WebDriverWait wait = new WebDriverWait(DriverFactory.getWebDriver(), Duration.ofSeconds(15))
		wait.until(ExpectedConditions.invisibilityOfElementLocated(By.id("loading-recipes")))
		
		// Procura o elemento com o aviso de validade
		// Usa um XPath que procura o texto exato no primeiro cartão
		TestObject warningText = new TestObject()
		warningText.addProperty("xpath", ConditionType.EQUALS, "//article[contains(@class, 'household-card')][1]//*[contains(text(), 'Usa produto a expirar')]")
		
		// FORÇA o teste a falhar se o elemento não existir
		WebUI.verifyElementPresent(warningText, 5, com.kms.katalon.core.model.FailureHandling.STOP_ON_FAILURE)
	}
}