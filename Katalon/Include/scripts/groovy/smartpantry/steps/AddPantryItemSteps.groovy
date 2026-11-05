package smartpantry.steps

import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.testobject.ConditionType
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then
import org.openqa.selenium.JavascriptExecutor
import com.kms.katalon.core.webui.driver.DriverFactory

class AddPantryItemSteps {
	
	String baseUrl = "http://localhost:8000/scan.html"

    // Helper para criar TestObjects dinâmicos baseados no ID do HTML
    private TestObject createTestObject(String id) {
        TestObject to = new TestObject(id)
        to.addProperty("id", ConditionType.EQUALS, id)
        return to
    }

    @Given("the user is on the product validation form")
    def navigateToForm() {
		WebUI.openBrowser('')
		WebUI.navigateToUrl(baseUrl)
        WebUI.executeJavaScript("document.getElementById('formContainer').style.display = 'block';", null)
		WebUI.waitForElementVisible(createTestObject("productName"), 10)
    }

    @Given("the user fills the product name with {string}")
    def fillProductName(String name) {
        WebUI.setText(createTestObject('productName'), name)
    }

    @Given("the user sets the category to {string}")
    def fillCategory(String category) {
        WebUI.setText(createTestObject('productCategory'), category)
    }

    @Given("the user types a new custom category {string}")
    def fillCustomCategory(String category) {
        WebUI.setText(createTestObject('productCategory'), category)
    }

    @Given("the user sets the quantity to {string}")
    def fillQuantity(String qty) {
        WebUI.setText(createTestObject('productQty'), qty)
    }

    @Given("the user leaves the product name empty")
    def emptyProductName() {
        WebUI.clearText(createTestObject('productName'))
    }

    @When("the user clicks the \"Guardar na Despensa\" button")
    def clickSaveButton() {
        WebUI.click(createTestObject('btn-save-item'))
    }

    @Then("the item should be saved in the pantry successfully")
    def verifyItemSaved() {
        // Valida se o localStorage tem dados
        String inventoryJson = WebUI.executeJavaScript("return localStorage.getItem('smartPantry_inventory');", null)
        assert inventoryJson != null && inventoryJson.contains("Arroz Agulha")
    }

    @Then("a success message is displayed")
    def verifySuccessMessage() {
        WebUI.waitForElementVisible(createTestObject('form-msg'), 5) // Espera até 5 segundos que apareça
        WebUI.verifyElementVisible(createTestObject('form-msg'))
        String msg = WebUI.getText(createTestObject('form-msg'))
        assert msg.contains("Sucesso")
    }

    @Then("the system should display an error message regarding the missing name")
    def verifyErrorMessage() {
        WebUI.waitForElementVisible(createTestObject('form-msg'), 5) // Espera até 5 segundos
        WebUI.verifyElementVisible(createTestObject('form-msg'))
        String msg = WebUI.getText(createTestObject('form-msg'))
        assert msg.contains("nome do produto é obrigatório")
    }

    @Then("the item must not be saved in the pantry")
    def verifyItemNotSaved() {
        // Garante que o localStorage não foi atualizado indevidamente
        String inventoryJson = WebUI.executeJavaScript("return localStorage.getItem('smartPantry_inventory');", null)
        if (inventoryJson != null) {
            assert !inventoryJson.contains("\"name\":\"\"")
        }
    }

    @Then("the item should be saved in the pantry with the category {string}")
    def verifyCustomCategorySaved(String category) {
        String inventoryJson = WebUI.executeJavaScript("return localStorage.getItem('smartPantry_inventory');", null)
        assert inventoryJson != null && inventoryJson.contains(category)
    }
}