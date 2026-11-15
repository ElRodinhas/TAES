package smartpantry.steps

import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import io.cucumber.java.Before
import io.cucumber.java.After
import io.cucumber.java.en.Given
import io.cucumber.java.en.When
import io.cucumber.java.en.Then

/** Browser acceptance tests stub only the recipe endpoint; real API evidence is demo/spike.py. */
class GenerateRecipesSteps {
    private TestObject byId(String id) {
        TestObject object = new TestObject(id)
        object.addProperty('css', ConditionType.EQUALS, "[data-testid='${id}']")
        return object
    }

    @Before('@generate-recipes')
    void openGenerator() {
        WebUI.openBrowser('')
        WebUI.navigateToUrl('http://localhost:8000/recipes.html')
    }

    @After('@generate-recipes')
    void closeGenerator() { WebUI.closeBrowser() }

    @Given('the generator has an active vegan profile for 2 portions and pantry tomatoes')
    void seedGenerator() {
        WebUI.executeJavaScript('''
            localStorage.setItem('smartPantry.households.v1', JSON.stringify({version:1,activeHouseholdId:'demo',households:[
                {id:'demo',name:'Casa',servings:2,lifestyle:'vegan',allergies:['Peanuts'],excludedIngredients:['cogumelos']}
            ]}));
            localStorage.setItem('smartPantry_inventory', JSON.stringify([{name:'tomate',quantity:300,unit:'g'}]));
            localStorage.removeItem('smartPantry.generatedRecipes.v1');
        ''', null)
        WebUI.refresh()
        WebUI.waitForElementVisible(byId('generate-recipe'), 10)
        WebUI.verifyElementAttributeValue(byId('generation-servings'), 'value', '2', 5)
    }

    private void mockService(String mode) {
        WebUI.executeJavaScript('''
            window.__generationCalls = [];
            const mode = arguments[0];
            const realFetch = window.fetch.bind(window);
            window.fetch = async (url, options) => {
                if (!String(url).includes('api/generate-recipe')) return realFetch(url, options);
                const data = JSON.parse(options.body);
                window.__generationCalls.push(data);
                if (mode !== 'ready' && mode !== 'missing') {
                    return {ok:false,json:async()=>({error:mode})};
                }
                if (mode === 'missing' && !data.allowMissing) {
                    return {ok:true,json:async()=>({status:'no_recipe',recipe:null})};
                }
                const ingredients = data.ingredients.map((item,index)=>({name:item.name,quantity:100,unit:'g',sourceIndex:index}));
                if (data.allowMissing) ingredients.push({name:'azeite',quantity:10,unit:'ml',sourceIndex:null});
                return {ok:true,json:async()=>({status:'ready',recipe:{title:'Arroz de tomate',servings:data.servings,
                    prepMinutes:5,cookMinutes:10,totalMinutes:15,ingredients,steps:['Corta o tomate.','Junta o arroz e aquece.']}})};
            };
        ''', Arrays.asList(mode))
    }

    @Given('the recipe service returns a structured recipe')
    void structuredService() { mockService('ready') }

    @Given('the recipe service cannot use only the supplied ingredients')
    void noRecipeService() { mockService('missing') }

    @Given('the recipe service fails with {string}')
    void failedService(String code) { mockService(code) }

    @Given('the generator has no household profile')
    void noProfile() {
        WebUI.executeJavaScript("localStorage.removeItem('smartPantry.households.v1')", null)
        WebUI.refresh()
        mockService('ready')
    }

    @When('I select pantry tomatoes and enter leftover rice')
    void enterIngredients() {
        WebUI.check(byId('generation-pantry-0'))
        WebUI.setText(byId('leftover-name'), 'arroz cozido')
        WebUI.setText(byId('leftover-amount'), '200 g')
        WebUI.click(byId('add-leftover'))
    }

    @When('I request a recipe for {int} portions')
    void generateRecipe(int servings) {
        WebUI.setText(byId('generation-servings'), servings.toString())
        WebUI.click(byId('generate-recipe'))
        WebUI.waitForElementAttributeValue(byId('generate-form'), 'aria-busy', 'false', 10)
    }

    @Then('the generation request includes both ingredients and the profile restrictions')
    void verifyRequest() {
        Boolean correct = WebUI.executeJavaScript('''
            const d = window.__generationCalls[0];
            return window.__generationCalls.length===1 && d.ingredients.length===2 && d.ingredients[0].name==='tomate' &&
                d.ingredients[1].name==='arroz cozido' && d.ingredients[1].available==='200 g' && d.servings===3 &&
                d.lifestyle==='vegan' && d.allergies[0]==='Peanuts' && d.excludedIngredients[0]==='cogumelos' && d.allowMissing===false;
        ''', null)
        WebUI.verifyEqual(correct, true)
    }

    @Then('a Portuguese recipe shows times, {int} portions, measurements and numbered steps')
    void verifyRecipe(int servings) {
        WebUI.waitForElementVisible(byId('save-generated-recipe'), 10)
        String content = WebUI.getText(byId('generated-recipe'))
        for (String expected : ['Arroz de tomate', servings + ' porções', 'Preparação: 5 min', 'Cozedura: 10 min', 'Total: 15 min', '100 g de tomate']) {
            WebUI.verifyEqual(content.contains(expected), true)
        }
        WebUI.verifyEqual(WebUI.executeJavaScript("return document.querySelectorAll('#generated-recipe ol li').length", null), 2)
    }

    @When('I save the generated recipe')
    void saveRecipe() { WebUI.click(byId('save-generated-recipe')) }

    @When('I save the generated recipe and reload')
    void saveAndReload() {
        saveRecipe()
        WebUI.refresh()
        WebUI.executeJavaScript('''
            window.__generationCalls = [];
            window.fetch = async () => { window.__generationCalls.push('unexpected'); throw new Error('offline'); };
        ''', null)
    }

    @Then('the saved recipe is still available without contacting the recipe service')
    void verifySaved() {
        WebUI.verifyEqual(WebUI.getText(byId('saved-recipes')).contains('Arroz de tomate'), true)
        WebUI.verifyEqual(WebUI.executeJavaScript('return window.__generationCalls.length', null), 0)
    }

    @Then('the generator asks permission to suggest missing ingredients')
    void verifyConsent() {
        WebUI.waitForElementVisible(byId('missing-consent'), 10)
        WebUI.verifyEqual(WebUI.executeJavaScript('return window.__generationCalls.length', null), 1)
        WebUI.verifyEqual(WebUI.getText(byId('generated-recipe')), '')
    }

    @When('I allow missing ingredients')
    void allowMissing() { WebUI.click(byId('allow-missing')) }

    @Then('the recipe marks the missing ingredients')
    void verifyMissing() {
        WebUI.waitForElementVisible(byId('save-generated-recipe'), 10)
        WebUI.verifyEqual(WebUI.getText(byId('generated-recipe')).contains('azeite — Em falta'), true)
        WebUI.verifyEqual(WebUI.executeJavaScript('return window.__generationCalls[1].allowMissing', null), true)
    }

    @Then('the generator shows an error and preserves my ingredients')
    void verifyFailure() {
        WebUI.verifyNotEqual(WebUI.getText(byId('generation-message')), '')
        WebUI.verifyElementChecked(byId('generation-pantry-0'), 5)
        WebUI.verifyEqual(WebUI.getText(byId('leftover-list')).contains('arroz cozido'), true)
        WebUI.verifyEqual(WebUI.getText(byId('generated-recipe')), '')
        WebUI.verifyElementClickable(byId('generate-recipe'))
    }

    @Then('the generator shows an error without calling the service')
    void verifyNoCall() {
        WebUI.verifyNotEqual(WebUI.getText(byId('generation-message')), '')
        WebUI.verifyEqual(WebUI.executeJavaScript('return window.__generationCalls.length', null), 0)
    }

    @When('recipe saving is unavailable on this device')
    void breakStorage() {
        WebUI.executeJavaScript('''
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'smartPantry.generatedRecipes.v1') throw new Error('quota');
                return original.call(this, key, value);
            };
        ''', null)
    }

    @Then('the generator reports that the recipe could not be saved')
    void verifyStorageError() {
        WebUI.verifyEqual(WebUI.getText(byId('generation-message')).contains('Não foi possível guardar'), true)
        WebUI.verifyEqual(WebUI.executeJavaScript("return localStorage.getItem('smartPantry.generatedRecipes.v1')", null), null)
    }
}
