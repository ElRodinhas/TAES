package smartpantry.steps

import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.util.KeywordUtil
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then

class AddMissingIngredientsToShoppingListSteps {

    String baseUrl = "http://localhost:8000/recipes.html"
    String shoppingListUrl = "http://localhost:8000/shopping-list.html"

    // ---------------------------------------------------------
    // BACKGROUND STEPS
    // ---------------------------------------------------------

    @Given("I am on the recipes page")
    def iAmOnTheRecipesPage() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(baseUrl)
    }

    @Given("my pantry has the ingredient {string}")
    def myPantryHasIngredient(String ingredientName) {
        String js = "localStorage.setItem('smartPantry_inventory', JSON.stringify([{name: '${ingredientName}', quantity: 1, expiry: '2027-12-31'}]));"
        WebUI.executeJavaScript(js, null)
        WebUI.refresh()
    }

    @Given("my shopping list is empty")
    def myShoppingListIsEmpty() {
        String js = "localStorage.setItem('smartPantry.shoppingList', JSON.stringify([]));"
        WebUI.executeJavaScript(js, null)
        WebUI.refresh()
    }

    // ---------------------------------------------------------
    // SCENARIO STEPS
    // ---------------------------------------------------------

    @When("I click on {string}")
    def iClickOn(String buttonText) {
        TestObject btn = new TestObject()
        btn.addProperty("xpath", ConditionType.EQUALS, "//button[contains(text(), '${buttonText}')]")
        WebUI.waitForElementClickable(btn, 10)
        WebUI.click(btn)
        WebUI.delay(3) 
    }

    @When("I click on {string} on the first recipe")
    def iClickOnAddMissingFirstRecipe(String buttonText) {
        TestObject btn = new TestObject()
        btn.addProperty("xpath", ConditionType.EQUALS, "(//button[contains(text(), '${buttonText}')])[1]")
        WebUI.waitForElementClickable(btn, 10)
        WebUI.click(btn)
    }

    @When("I click on {string} on a recipe that uses {string}")
    def iClickOnAddMissingRecipeWithIngredient(String buttonText, String ingredient) {
        TestObject btn = new TestObject()
        String ingredientLower = ingredient.toLowerCase()
        String xpath = "//article[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${ingredientLower}')]//button[contains(text(), '${buttonText}')]"
        btn.addProperty("xpath", ConditionType.EQUALS, xpath)
        WebUI.waitForElementClickable(btn, 15)
        WebUI.click(btn)
    }

    @Then("I accept the confirmation alert")
    def iAcceptTheConfirmationAlert() {
        WebUI.delay(1)
        WebUI.waitForAlert(5)
        WebUI.acceptAlert()
        WebUI.delay(1) 
    }

    @Then("I navigate to the shopping list page")
    def iNavigateToTheShoppingListPage() {
        WebUI.navigateToUrl(shoppingListUrl)
        WebUI.delay(2)
    }

    @Then("I should see the ingredient {string} in the shopping list")
    def iShouldSeeIngredient(String ingredient) {
        WebUI.verifyTextPresent(ingredient, false, FailureHandling.STOP_ON_FAILURE)
        WebUI.closeBrowser()
    }

    @Then("I should NOT see the ingredient {string} in the shopping list")
    def iShouldNotSeeIngredient(String ingredient) {
        WebUI.verifyTextNotPresent(ingredient, false, FailureHandling.STOP_ON_FAILURE)
        WebUI.closeBrowser()
    }

    @Then("the shopping list should not be empty")
    def theShoppingListShouldNotBeEmpty() {
        TestObject listItem = new TestObject()
        listItem.addProperty("xpath", ConditionType.EQUALS, "//ul[@id='shopping-list-container']//li")
        WebUI.verifyElementPresent(listItem, 5, FailureHandling.STOP_ON_FAILURE)
        WebUI.closeBrowser()
    }
}