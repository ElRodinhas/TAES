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
    Given the user is on the scanner page
    When the user scans a known barcode "5449000000996"
    And edits the item name to "Produto Editado Teste"
    And fills the required form fields
    And clicks the save button
    Then the item should be saved with the updated details

  Scenario: Unlisted barcode opens manual entry
    When the user scans an unlisted barcode "0000000000001"
    Then the form should open for manual entry with empty product details