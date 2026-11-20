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