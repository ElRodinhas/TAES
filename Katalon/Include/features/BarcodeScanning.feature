
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