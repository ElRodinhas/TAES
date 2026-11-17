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
