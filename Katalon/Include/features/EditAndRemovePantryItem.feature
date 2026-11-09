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
Feature: Edit and remove pantry item

	As a user
	I want to edit or delete items
	So that my inventory stays accurate

  Background:
	Given the user is on the pantry list page
	And there is an item named "Arroz" in the pantry
	
  Scenario: Edit the quantity of an existing item
    When the user clicks to edit the quantity of "Arroz"
    And changes the value to "3"
    And saves the edit
    Then the item "Arroz" should show the updated quantity of "3"

  Scenario: Remove an item from the pantry
	When the user clicks to delete the item "Arroz"
	And confirms the removal action
	Then the item "Arroz" should disappear from the pantry list