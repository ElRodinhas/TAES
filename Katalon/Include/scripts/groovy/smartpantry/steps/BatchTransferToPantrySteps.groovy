package smartpantry.steps

import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import groovy.json.JsonSlurper

import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then

class BatchTransferToPantrySteps {

    private final String SHOPPING_LIST_URL = "http://localhost:8000/shopping-list.html"

    private TestObject createById(String id) {
        TestObject to = new TestObject(id)
        to.addProperty("id", ConditionType.EQUALS, id)
        return to
    }

    @Given("the shopping list contains checked items {string} and {string} and unchecked item {string}")
    def seedMixedShoppingList(String checked1, String checked2, String unchecked1) {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(SHOPPING_LIST_URL)

        String listJson = """
        [
          {"name": "${checked1}", "quantity": 1, "unit": "un", "checked": true},
          {"name": "${checked2}", "quantity": 1, "unit": "kg", "checked": true},
          {"name": "${unchecked1}", "quantity": 4, "unit": "un", "checked": false}
        ]
        """
        WebUI.executeJavaScript("window.localStorage.setItem('smartPantry.shoppingList', arguments[0]);", Arrays.asList(listJson))
    }

    @Given("the shopping list contains only unchecked item {string}")
    def seedUncheckedShoppingList(String unchecked1) {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(SHOPPING_LIST_URL)

        String listJson = """
        [
          {"name": "${unchecked1}", "quantity": 1, "unit": "un", "checked": false}
        ]
        """
        WebUI.executeJavaScript("window.localStorage.setItem('smartPantry.shoppingList', arguments[0]);", Arrays.asList(listJson))
        WebUI.refresh()
    }

    @Given("the pantry inventory is empty")
    def clearPantryInventory() {
        WebUI.executeJavaScript("window.localStorage.setItem('smartPantry_inventory', '[]');", null)
        WebUI.refresh()
    }

    @When("the user opens batch transfer for checked items")
    def openBatchTransfer() {
        TestObject openBtn = createById("btn-open-batch-transfer")
        WebUI.waitForElementClickable(openBtn, 10)
        WebUI.click(openBtn)
        WebUI.waitForElementVisible(createById("batch-transfer-section"), 5)
    }

    @When("the user attempts to open batch transfer")
    def attemptOpenBatchTransfer() {
        TestObject openBtn = createById("btn-open-batch-transfer")
        WebUI.waitForElementClickable(openBtn, 10)
        WebUI.click(openBtn)
    }

    private void fillTransferRow(int index, String qty, String category, String expiry) {
        TestObject qtyInput = createById("batch-qty-${index}")
        TestObject catSelect = createById("batch-category-${index}")

        WebUI.setText(qtyInput, qty)
        WebUI.selectOptionByValue(catSelect, category, false)
        WebUI.executeJavaScript(
            "document.getElementById(arguments[0]).value = arguments[1];",
            Arrays.asList("batch-expiry-${index}".toString(), expiry)
        )
    }

    @When("sets custom quantity {string}, category {string}, and expiry {string} for the first item")
    def setFirstItemDetails(String qty, String category, String expiry) {
        fillTransferRow(0, qty, category, expiry)
    }

    @When("sets custom quantity {string}, category {string}, and expiry {string} for the second item")
    def setSecondItemDetails(String qty, String category, String expiry) {
        fillTransferRow(1, qty, category, expiry)
    }

    @When("confirms the batch transfer")
    def confirmBatchTransfer() {
        TestObject confirmBtn = createById("btn-confirm-batch-transfer")
        WebUI.waitForElementClickable(confirmBtn, 5)
        WebUI.click(confirmBtn)
        WebUI.delay(1)
    }

    @Then("the pantry inventory should contain {string} with quantity {string}, category {string}, and expiry {string}")
    def verifyPantryContainsItem(String name, String expectedQty, String expectedCategory, String expectedExpiry) {
        String rawInventory = WebUI.executeJavaScript("return window.localStorage.getItem('smartPantry_inventory');", null) as String
        def inventory = new JsonSlurper().parseText(rawInventory ?: "[]")

        def match = inventory.find { it.name == name }
        assert match != null : "Expected '${name}' in pantry inventory, but got: ${rawInventory}"
        assert match.quantity.toString() == expectedQty : "Expected quantity ${expectedQty} for '${name}', got ${match.quantity}"
        assert match.category == expectedCategory : "Expected category '${expectedCategory}' for '${name}', got '${match.category}'"
        assert match.expiry == expectedExpiry : "Expected expiry '${expectedExpiry}' for '${name}', got '${match.expiry}'"
    }

    @Then("the shopping list should only contain {string}")
    def verifyRemainingShoppingList(String remainingName) {
        try {
            String rawList = WebUI.executeJavaScript("return window.localStorage.getItem('smartPantry.shoppingList');", null) as String
            def list = new JsonSlurper().parseText(rawList ?: "[]")
            assert list.size() == 1 : "Expected 1 remaining item in shopping list, got ${list.size()}: ${rawList}"
            assert list[0].name == remainingName : "Expected '${remainingName}' to remain, got '${list[0].name}'"
        } finally {
            WebUI.closeBrowser()
        }
    }

    @Then("an alert message should indicate that no items are selected")
    def verifyNoSelectionAlert() {
        try {
            TestObject msgObj = createById("shopping-list-msg")
            WebUI.waitForElementVisible(msgObj, 5)
            String text = WebUI.getText(msgObj)
            assert text.length() > 0 : "Expected an error/warning message when no items are checked"
        } finally {
            WebUI.closeBrowser()
        }
    }
}