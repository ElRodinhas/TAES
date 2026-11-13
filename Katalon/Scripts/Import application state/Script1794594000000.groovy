import com.kms.katalon.core.cucumber.keyword.CucumberBuiltinKeywords as CucumberKW

CucumberKW.GLUE = ['smartpantry.steps']
CucumberKW.runFeatureFile('Include/features/ImportApplicationState.feature')
