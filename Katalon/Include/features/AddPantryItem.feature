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
Feature: Add pantry item

	As a user
	I want to log an item with name, category, quantity, unit and expiration date
	So that I know what I have.
	
  Background:
    Given the user is on the product validation form
    	
  Scenario: Save the item successfully with valid details
    Given the user fills the product name with "Arroz Agulha"
    And the user sets the category to "Cereais"
    And the user sets the quantity to "2"
    When the user clicks the "Guardar na Despensa" button
    Then the item should be saved in the pantry successfully
    And a success message is displayed
    
  Scenario: Prevent saving when the product name is empty
    Given the user leaves the product name empty
    When the user clicks the "Guardar na Despensa" button
    Then the system should display an error message regarding the missing name
    And the item must not be saved in the pantry
    
  Scenario: Add an item with a custom category
    Given the user fills the product name with "Massa Fusilli"
    And the user types a new custom category "Massas Italianas"
    When the user clicks the "Guardar na Despensa" button
    Then the item should be saved in the pantry with the category "Massas Italianas"
