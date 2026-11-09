package smartpantry.steps
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then

class EditAndRemovePantryItemSteps {

    // Função auxiliar para criar objetos dinâmicos sem precisar do Object Repository
    def createTestObject(String xpath) {
        TestObject to = new TestObject()
        to.addProperty("xpath", ConditionType.EQUALS, xpath)
        return to
    }

    @Given("the user is on the pantry list page")
    def userOnPantryPage() {
        WebUI.navigateToUrl("http://localhost:8000/pantry.html") // Ajusta a porta se necessário
        WebUI.waitForPageLoad(5)
    }

    @Given("there is an item named {string} in the pantry")
	def itemExistsInPantry(String itemName) {
	    String js = "localStorage.setItem('smartPantry_inventory', JSON.stringify([{id: '12345', name: '" + itemName + "', category: 'Geral', quantity: 1, expiry: '2026-12-31'}]));"
	    WebUI.executeJavaScript(js, null)
	    
	    WebUI.refresh()
	    WebUI.waitForPageLoad(5)

	    WebUI.waitForElementPresent(createTestObject("//*[contains(text(), '${itemName}')]"), 5)
	    WebUI.verifyElementPresent(createTestObject("//*[contains(text(), '${itemName}')]"), 5)
}

    // --- CENÁRIO: EDITAR --- //

    @When("the user clicks to edit the quantity of {string}")
    def clickEditQuantity(String itemName) {
        // Assume que vais criar um botão com class="btn-edit" perto do nome do item
        WebUI.click(createTestObject("//div[contains(., '${itemName}')]//button[contains(@class, 'btn-edit')]"))
    }

    @When("changes the value to {string}")
    def changeQuantityValue(String newQuantity) {
        // Assume um input de quantidade que aparece ou fica editável
        TestObject inputQtd = createTestObject("//input[@name='edit-quantity']")
        WebUI.clearText(inputQtd)
        WebUI.setText(inputQtd, newQuantity)
    }

    @When("saves the edit")
    def saveEdit() {
        WebUI.click(createTestObject("//button[contains(@class, 'btn-save-edit')]"))
    }

    @Then("the item {string} should show the updated quantity of {string}")
    def verifyUpdatedQuantity(String itemName, String expectedQuantity) {
        WebUI.verifyElementPresent(createTestObject("//div[contains(., '${itemName}') and contains(., '${expectedQuantity}')]"), 3)
    }

    // --- CENÁRIO: APAGAR --- //

    @When("the user clicks to delete the item {string}")
    def clickDelete(String itemName) {
        // Assume que vais criar um botão de apagar com class="btn-delete"
        WebUI.click(createTestObject("//div[contains(., '${itemName}')]//button[contains(@class, 'btn-delete')]"))
    }

    @When("confirms the removal action")
    def confirmRemoval() {
        // Se usares um window.confirm() nativo do browser:
        WebUI.acceptAlert()
        // Se for um modal HTML teu, usa WebUI.click no botão "Sim"
    }

    @Then("the item {string} should disappear from the pantry list")
    def verifyItemDisappeared(String itemName) {
        WebUI.verifyElementNotPresent(createTestObject("//*[contains(text(), '${itemName}')]"), 3)
    }
}