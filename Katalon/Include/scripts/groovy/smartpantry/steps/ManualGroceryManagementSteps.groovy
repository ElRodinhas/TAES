package smartpantry.steps

import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.util.KeywordUtil
import io.cucumber.java.After
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then
import org.openqa.selenium.By
import org.openqa.selenium.WebElement
import org.openqa.selenium.support.ui.WebDriverWait
import org.openqa.selenium.support.ui.ExpectedConditions
import java.time.Duration

class ManualGroceryManagementSteps {

    String baseUrl = "http://localhost:8000/shopping-list.html"

    private TestObject createTestObject(String id) {
        TestObject to = new TestObject(id)
        to.addProperty("id", ConditionType.EQUALS, id)
        return to
    }

    // ---------------------------------------------------------
    // BACKGROUND STEPS
    // ---------------------------------------------------------

    @Given("the user is on the shopping list page")
    def userIsOnShoppingListPage() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(baseUrl)
        WebUI.maximizeWindow()
        WebUI.waitForElementVisible(createTestObject("shopping-list-container"), 10)
    }

    @Given("the shopping list is empty")
    def shoppingListIsEmpty() {
        String js = "localStorage.setItem('smartPantry.shoppingList', JSON.stringify([]));"
        WebUI.executeJavaScript(js, null)
        WebUI.refresh()
        WebUI.waitForElementVisible(createTestObject("shopping-list-container"), 10)
    }

    // ---------------------------------------------------------
    // SCENARIO 1: ADD
    // ---------------------------------------------------------

    @When("the user adds an item with name {string} and quantity {int}")
    def userAddsItem(String name, int quantity) {
        WebUI.setText(createTestObject("input-item-name"), name)
        WebUI.setText(createTestObject("input-item-qty"), quantity.toString())
        WebUI.click(createTestObject("btn-add-item"))
        WebUI.delay(1)
    }

    @Then("the item {string} should appear in the list with quantity {int}")
    def itemShouldAppearInList(String name, int quantity) {
        TestObject item = new TestObject()
        item.addProperty("xpath", ConditionType.EQUALS, "//li[contains(., '${name}') and contains(., '${quantity}')]")
        WebUI.verifyElementPresent(item, 5, FailureHandling.STOP_ON_FAILURE)
    }

    // ---------------------------------------------------------
    // SCENARIO 2: EDIT
    // ---------------------------------------------------------

    @Given("the shopping list has an item {string} with quantity {int}")
    def shoppingListHasItem(String name, int quantity) {
        String js = """
            localStorage.setItem('smartPantry.shoppingList', JSON.stringify([
                { name: '${name}', quantity: ${quantity}, unit: 'un', checked: false }
            ]));
        """
        WebUI.executeJavaScript(js, null)
        WebUI.refresh()
        WebUI.waitForElementVisible(createTestObject("shopping-list-container"), 10)
    }

    @When("the user edits the item to name {string} and quantity {int}")
    def userEditsItem(String newName, int newQuantity) {
        TestObject editBtn = new TestObject()
        editBtn.addProperty("xpath", ConditionType.EQUALS, "(//button[contains(@class, 'btn-edit')])[1]")
        WebUI.click(editBtn)
        WebUI.delay(1)

        TestObject nameInput = new TestObject()
        nameInput.addProperty("xpath", ConditionType.EQUALS, "(//input[contains(@id, 'edit-item-name')])[1]")
        WebUI.setText(nameInput, newName)

        TestObject qtyInput = new TestObject()
        qtyInput.addProperty("xpath", ConditionType.EQUALS, "(//input[contains(@id, 'edit-item-qty')])[1]")
        WebUI.setText(qtyInput, newQuantity.toString())

        TestObject saveBtn = new TestObject()
        saveBtn.addProperty("xpath", ConditionType.EQUALS, "(//button[contains(@id, 'btn-save-edit')])[1]")
        WebUI.click(saveBtn)
        WebUI.delay(1)
    }

    @Then("the item {string} should appear with quantity {int}")
    def itemShouldAppearWithQuantity(String name, int quantity) {
        TestObject item = new TestObject()
        item.addProperty("xpath", ConditionType.EQUALS, "//li[contains(., '${name}') and contains(., '${quantity}')]")
        WebUI.verifyElementPresent(item, 5, FailureHandling.STOP_ON_FAILURE)
    }

    // ---------------------------------------------------------
    // SCENARIO 3: REMOVE
    // ---------------------------------------------------------

    @When("the user removes the item {string}")
    def userRemovesItem(String name) {
        TestObject deleteBtn = new TestObject()
        deleteBtn.addProperty("xpath", ConditionType.EQUALS, "(//button[contains(@class, 'btn-delete')])[1]")
        WebUI.click(deleteBtn)
        WebUI.delay(1)
    }

    @Then("the shopping list should be empty")
    def shoppingListShouldBeEmpty() {
        TestObject emptyMessage = new TestObject()
        emptyMessage.addProperty("xpath", ConditionType.EQUALS, "//li[contains(text(), 'A tua lista de compras está vazia')]")
        WebUI.verifyElementPresent(emptyMessage, 5, FailureHandling.STOP_ON_FAILURE)
    }

    // ---------------------------------------------------------
    // SCENARIO 4: MARK AS PURCHASED
    // ---------------------------------------------------------

    @When("the user marks the item {string} as purchased")
    def userMarksItemAsPurchased(String name) {
        TestObject checkbox = new TestObject()
        checkbox.addProperty("xpath", ConditionType.EQUALS, "(//input[@type='checkbox'])[1]")
        WebUI.click(checkbox)
        WebUI.delay(1)
    }

    @Then("the item {string} should be checked")
    def itemShouldBeChecked(String name) {
        TestObject checkbox = new TestObject()
        checkbox.addProperty("xpath", ConditionType.EQUALS, "(//input[@type='checkbox'])[1]")
        WebUI.verifyElementChecked(checkbox, 5)
    }

    @After
    void closeBrowser() {
        try {
            WebUI.closeBrowser()
        } catch (Exception ignored) {
        }
    }
}