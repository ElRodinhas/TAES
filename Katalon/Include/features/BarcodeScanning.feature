#Author: your.email@your.domain.com
#Keywords Summary :
#Feature: List of scenarios.
#Scenario: Business rule through list of steps with arguments.
#Given: Some precondition step
#When: Some key actions
#Then: To observe outcomes or validation
#And,But: To enumerate more Given,When,Then steps
#Scenario Outline: List of steps for data-driven as an Examples and <placeholder>
#Examples: Container for s table
#Background: List of steps run before each of the scenarios
#""" (Doc Strings)
#| (Data Tables)
#@ (Tags/Labels):To group Scenarios
#<> (placeholder)
#""
## (Comments)
#Sample Feature Definition Template
@tag
Feature: Barcode Scanning and Form Auto-fill

  As a user
  I want to scan a barcode
  So that the item form is filled automatically

  Background:
    Given the user is on the scanner page

  Scenario: Scan a known barcode and auto-fill the form
    When the user scans a known barcode "5449000000996"
    Then the item form should be auto-filled with product details

  Scenario: Edit auto-filled data before saving
    When the user scans a known barcode "5449000000996"
    And edits the item name to "Produto Editado Teste"
    And fills the required form fields
    And clicks the save button
    Then the item should be saved with the updated details

  Scenario: Unlisted barcode opens manual entry
    When the user scans an unlisted barcode "0000000000001"
    Then the form should open for manual entry with empty product details

  @barcode-uniqueness
  Scenario: Reject a barcode already assigned to another product
    Given the pantry contains Arroz with barcode "4006381333931"
    When I manually submit product "Leite" with barcode "4006381333931"
    Then the duplicate barcode error should be displayed
    And the pantry inventory should remain unchanged

  @barcode-uniqueness
  Scenario Outline: Save products without conflicting barcode assignments
    Given the pantry contains Arroz with barcode "4006381333931"
    When I manually submit product "<name>" with barcode "<enteredBarcode>"
    Then the pantry should contain <count> products
    And pantry product "<name>" should have barcode "<savedBarcode>" and quantity <quantity>

    Examples:
      | name  | enteredBarcode | savedBarcode | count | quantity |
      | arroz | 4006381333931  | 4006381333931 | 1     | 3        |
      | Leite | 036000291452   | 036000291452  | 2     | 2        |
      | Leite |               |              | 2     | 2        |

  @barcode-uniqueness
  Scenario: Trim barcode spaces while preserving leading zeros
    Given the pantry contains Arroz with barcode "4006381333931"
    When I manually submit product "Leite" with barcode " 036000291452 "
    Then the pantry should contain 2 products
    And pantry product "Leite" should have barcode "036000291452" and quantity 2
