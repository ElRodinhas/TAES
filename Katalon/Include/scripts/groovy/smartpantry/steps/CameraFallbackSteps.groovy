package smartpantry.steps

import static com.kms.katalon.core.testobject.ConditionType.EQUALS
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
import org.openqa.selenium.support.ui.WebDriverWait
import org.openqa.selenium.support.ui.ExpectedConditions
import java.time.Duration

class CameraFallbackSteps {

    String baseUrl = "http://localhost:8000/scan.html"

    // Função auxiliar para encontrar elementos pelo ID
    private TestObject createTestObject(String id) {
        TestObject to = new TestObject(id)
        to.addProperty("id", ConditionType.EQUALS, id)
        return to
    }


        @When("the user forces the fallback mode")
    def userForcesFallbackMode() {
        TestObject btnFallback = createTestObject("btn-force-fallback")
        
        // Verifica se o botão está visível. 
        // Se o Katalon não tiver câmara, o fallback já apareceu e o botão está escondido.
        if (WebUI.verifyElementVisible(btnFallback, FailureHandling.OPTIONAL)) {
            WebUI.click(btnFallback)
        } else {
            KeywordUtil.logInfo("O botão de fallback não está visível. A câmara falhou automaticamente, o que já ativou o fallback.")
        }
        
        WebUI.delay(1)
    }

    @Then("the camera area should be hidden")
    def cameraAreaIsHidden() {
        // Verifica se a div da câmara ficou com display: none
        boolean isCameraHidden = WebUI.executeJavaScript(
            "return document.getElementById('camera-container').style.display === 'none';", null
        )
        WebUI.verifyEqual(isCameraHidden, true, FailureHandling.CONTINUE_ON_FAILURE)
    }

    @Then("the fallback area should be visible")
    def fallbackAreaIsVisible() {
        WebUI.verifyElementVisible(createTestObject("fallback-container"))
    }

    @Then("the upload and manual options should be displayed")
    def uploadAndManualOptionsAreVisible() {
        WebUI.verifyElementVisible(createTestObject("barcodeFile"))
        WebUI.verifyElementVisible(createTestObject("manualBarcode"))
        WebUI.takeScreenshot("US08_Fallback_Visible.png")
    }

    @When("the user enters a valid barcode manually {string}")
    def userEntersBarcodeManually(String barcode) {
        WebUI.setText(createTestObject("manualBarcode"), barcode)
        WebUI.click(createTestObject("lookupBarcodeBtn"))
        
        // Espera que a API termine de procurar (o campo deixa de dizer "A procurar...")
        WebDriverWait wait = new WebDriverWait(DriverFactory.getWebDriver(), Duration.ofSeconds(15))
        wait.until(ExpectedConditions.not(ExpectedConditions.attributeToBe(
            By.id("productName"), "value", "A procurar produto..."
        )))
    }

    @When("uploads a barcode image file")
    def userUploadsBarcodeImage() {
        // Vai buscar o caminho absoluto da pasta do teu projeto Katalon
        String projectDir = com.kms.katalon.core.configuration.RunConfiguration.getProjectDir()
        String imagePath = projectDir + "/images/barcode_test.jpeg"
        
        WebUI.uploadFile(createTestObject("barcodeFile"), imagePath)
        WebUI.delay(2) // Espera que a biblioteca html5-qrcode leia a imagem
    }

    @Then("the item form should open with the barcode filled from the image")
    def formIsOpenWithBarcodeFromImage() {
        WebUI.verifyElementVisible(createTestObject("formContainer"))
        
        // Verifica se o campo de código de barras ficou preenchido
        String barcodeValue = WebUI.getAttribute(createTestObject("barcodeVal"), 'value')
        WebUI.verifyNotEqual(barcodeValue, "", FailureHandling.CONTINUE_ON_FAILURE)
        WebUI.verifyNotEqual(barcodeValue, null, FailureHandling.CONTINUE_ON_FAILURE)
        
        WebUI.takeScreenshot("US08_Image_Upload_Success.png")
        WebUI.closeBrowser()
    }
}