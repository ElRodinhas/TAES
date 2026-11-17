package smartpantry.steps

import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then

class DietaryFilteringSteps {

    private final String RECIPES_URL = "http://localhost:8000/recipes.html"

    private TestObject createById(String id) {
        TestObject to = new TestObject(id)
        to.addProperty("id", ConditionType.EQUALS, id)
        return to
    }

    private void seedProfileAndNavigate(String lifestyle, List<String> allergies, List<String> excluded) {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(RECIPES_URL)

        String allergiesJson = allergies.collect { "\"${it}\"" }.join(",")
        String excludedJson = excluded.collect { "\"${it}\"" }.join(",")

        String profileState = """
        {
          "version": 1,
          "activeHouseholdId": "test-profile-1",
          "households": [
            {
              "id": "test-profile-1",
              "name": "Test Household",
              "servings": 2,
              "lifestyle": "${lifestyle}",
              "allergies": [${allergiesJson}],
              "excludedIngredients": [${excludedJson}]
            }
          ]
        }
        """

        WebUI.executeJavaScript("window.localStorage.setItem('smartPantry.households.v1', arguments[0]);", Arrays.asList(profileState))
    }

    @Given("the active profile has allergy {string}")
    def setProfileAllergy(String allergy) {
        seedProfileAndNavigate("omnivore", [allergy], [])
    }

    @Given("the active profile has dietary lifestyle {string}")
    def setProfileLifestyle(String lifestyle) {
        seedProfileAndNavigate(lifestyle, [], [])
    }

    @Given("the active profile excludes the ingredient {string}")
    def setProfileExcludedIngredient(String ingredient) {
        seedProfileAndNavigate("omnivore", [], [ingredient])
    }

    @Given("the pantry contains {string}")
    def seedPantryInventory(String ingredientsCsv) {
        def items = ingredientsCsv.split(",").collect { it.trim() }.findAll { it.length() > 0 }
        String inventoryJson = "[" + items.collect { name ->
            """{"name": "${name}", "quantity": 1, "expiry": "2026-12-31"}"""
        }.join(",") + "]"

        WebUI.executeJavaScript("window.localStorage.setItem('smartPantry_inventory', arguments[0]);", Arrays.asList(inventoryJson))
        WebUI.refresh()
    }

    @When("the user searches for recipes")
    def searchRecipes() {
        TestObject fetchBtn = createById("btn-fetch-recipes")
        WebUI.waitForElementClickable(fetchBtn, 10)
        WebUI.click(fetchBtn)

        TestObject loadingDiv = createById("loading-recipes")
        WebUI.waitForElementNotVisible(loadingDiv, 15, FailureHandling.OPTIONAL)
        WebUI.delay(1)
    }

    private void assertForbiddenWordsAbsent(List<String> forbiddenTerms) {
        try {
            TestObject listObj = createById("recipes-list")
            String recipesText = WebUI.getText(listObj).toLowerCase()

            for (String term : forbiddenTerms) {
                String cleanTerm = term.trim().toLowerCase()
                assert !recipesText.contains(cleanTerm) : "Found unsuitable ingredient '${cleanTerm}' in displayed recipes:\n${recipesText}"
            }
        } finally {
            WebUI.closeBrowser()
        }
    }

    @Then("no displayed recipe should contain {string} or {string}")
    def verifyTwoTermsAbsent(String term1, String term2) {
        assertForbiddenWordsAbsent([term1, term2])
    }

    @Then("no displayed recipe should contain {string}, {string}, or {string}")
    def verifyThreeTermsAbsent(String term1, String term2, String term3) {
        assertForbiddenWordsAbsent([term1, term2, term3])
    }

    @Then("no displayed recipe should contain {string}")
    def verifySingleTermAbsent(String term1) {
        assertForbiddenWordsAbsent([term1])
    }
}