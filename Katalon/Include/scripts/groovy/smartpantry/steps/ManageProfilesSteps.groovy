package smartpantry.steps

import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then

class ManageProfilesSteps {

    String baseUrl = "http://localhost:8000/index.html"

    private TestObject createById(String id) {
        TestObject to = new TestObject(id)
        to.addProperty("id", ConditionType.EQUALS, id)
        return to
    }

    private TestObject createByTestId(String testId) {
        TestObject to = new TestObject(testId)
        to.addProperty("data-testid", ConditionType.EQUALS, testId)
        return to
    }

    private String getHouseholdIdByName(String profileName) {
        String script = """
            const cards = Array.from(document.querySelectorAll('[data-testid="household-card"]'));
            const match = cards.find(c => c.querySelector('h3')?.textContent.trim() === arguments[0]);
            return match ? match.dataset.householdId : null;
        """
        return WebUI.executeJavaScript(script, Arrays.asList(profileName))
    }
	
	private boolean profileExistsExact(String profileName) {
		return getHouseholdIdByName(profileName) != null
	}

	private void ensureProfileExists(String profileName) {
		if (!profileExistsExact(profileName)) {
			WebUI.click(createById("add-household"))
			
			TestObject nameInput = createById("household-name")
			WebUI.waitForElementVisible(nameInput, 3)
			WebUI.clearText(nameInput)
			WebUI.setText(nameInput, profileName)
			
			WebUI.setText(createById("serving-count"), "2")
			WebUI.click(createById("save-household"))
			WebUI.waitForElementVisible(createById("household-list"), 5)
		}
	}

    @Given("the user is on the profiles settings page")
    def userOnProfilesPage() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(baseUrl)
        WebUI.waitForPageLoad(5)
        
        if (WebUI.verifyElementVisible(createById("setup-screen"), FailureHandling.OPTIONAL)) {
            WebUI.setText(createById("household-name"), "My household2")
            WebUI.setText(createById("serving-count"), "4")
            WebUI.click(createById("save-household"))
            WebUI.waitForElementVisible(createById("households-screen"), 5)
        }
    }

    // --- CENÁRIO 1: CRIAR PERFIL --- //

    @When("the user clicks on the {string} button")
    def clickAddProfile(String btnText) {
        WebUI.click(createById("add-household"))
    }

    @When("fills the profile name with {string} and serving count with {string}")
    def fillProfileBasicInfo(String name, String servings) {
        TestObject nameInput = createById("household-name")
        TestObject servingsInput = createById("serving-count")
        
        WebUI.waitForElementVisible(nameInput, 3)
        WebUI.clearText(nameInput)
        WebUI.setText(nameInput, name)
        
        WebUI.clearText(servingsInput)
        WebUI.setText(servingsInput, servings)
    }

    @When("selects the dietary preference {string}")
    def selectDiet(String diet) {
        WebUI.selectOptionByLabel(createById("dietary-lifestyle"), diet, false)
    }

    @When("saves the profile")
    def saveNewProfile() {
        WebUI.click(createById("save-household"))
    }

    @Then("the profile {string} should appear in the profiles list")
    def verifyProfileCreated(String profileName) {
        TestObject listContainer = createById("household-list")
        WebUI.waitForElementVisible(listContainer, 5)
        assert profileExistsExact(profileName) : "O perfil '${profileName}' não apareceu na lista"
    }

    // --- CENÁRIO 2: EDITAR RESTRIÇÕES --- //

    @Given("there is a profile named {string} in the list")
    def profileExists(String profileName) {
        ensureProfileExists(profileName)
    }

    @When("the user clicks to edit the profile {string}")
    def clickEditProfile(String profileName) {
        String id = getHouseholdIdByName(profileName)
        assert id != null : "Perfil '${profileName}' não encontrado"
        WebUI.click(createById("edit-household-${id}"))
    }

    @When("adds the allergy {string}")
    def addAllergy(String allergy) {
        String testId = "allergy-" + allergy.toLowerCase().replaceAll("\\s+", "-")
        TestObject allergyCheckbox = createByTestId(testId)
        
        WebUI.waitForElementVisible(allergyCheckbox, 3)
        if (!WebUI.verifyElementChecked(allergyCheckbox, 1, FailureHandling.OPTIONAL)) {
            WebUI.click(allergyCheckbox)
        }
    }

    @When("saves the profile changes")
    def saveProfileChanges() {
        WebUI.click(createById("save-household"))
    }

    @Then("the profile {string} should display {string} in its allergies")
    def verifyAllergyDisplayed(String profileName, String allergy) {
        TestObject listContainer = createById("household-list")
        WebUI.waitForElementVisible(listContainer, 5)
        String listText = WebUI.getText(listContainer)
        assert listText.contains(profileName) && listText.contains(allergy)
    }

    // --- CENÁRIOS 3 e 4: APAGAR PERFIL (INATIVO VS ATIVO) --- //

    @Given("there is an inactive profile named {string}")
    def inactiveProfileExists(String profileName) {
        ensureProfileExists(profileName)
        
        // Comparação exata (trim) para não confundir "My household" com "My household2"
        String activeName = WebUI.getText(createById("active-title")).trim()
        assert activeName != profileName : "O perfil '${profileName}' está ativo e não pode ser apagado"
    }

    @When("the user clicks to delete the profile {string}")
    def clickDeleteInactiveProfile(String profileName) {
        String id = getHouseholdIdByName(profileName)
        assert id != null : "Perfil '${profileName}' não encontrado"
        WebUI.click(createById("delete-household-${id}"))
    }

    @When("confirms the profile deletion")
    def confirmDelete() {
        // Clica no botão inline 'Confirm delete' gerado pelo renderHouseholdCard
        TestObject confirmBtn = createByTestId("confirm-delete")
        WebUI.waitForElementVisible(confirmBtn, 3)
        WebUI.click(confirmBtn)
    }

    @Then("the profile {string} should be removed from the list")
    def verifyProfileRemoved(String profileName) {
        assert !profileExistsExact(profileName) : "O perfil '${profileName}' ainda se encontra na lista"
    }

    @Given("there is an active profile named {string}")
    def activeProfileExists(String profileName) {
        assert WebUI.getText(createById("active-title")).contains(profileName)
    }

    @When("the user tries to delete the active profile {string}")
    def tryDeleteActiveProfile(String profileName) {
        String id = getHouseholdIdByName(profileName)
        TestObject deleteBtn = createById("delete-household-${id}")
        
        if (WebUI.verifyElementPresent(deleteBtn, 2, FailureHandling.OPTIONAL)) {
            WebUI.click(deleteBtn)
            TestObject confirmBtn = createByTestId("confirm-delete")
            if (WebUI.verifyElementVisible(confirmBtn, FailureHandling.OPTIONAL)) {
                WebUI.click(confirmBtn)
            }
        }
    }
    @Then("the active profile {string} should remain in the list")
    def verifyActiveProfileRemains(String profileName) {
        String listText = WebUI.getText(createById("household-list"))
        assert listText.contains(profileName)
    }
}