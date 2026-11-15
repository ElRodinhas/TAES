@tag
Feature: Manage profiles in settings

	As a user
	I want to create, edit and delete profiles
	So that I can keep dietary information up to date.
  
  Background:
	Given the user is on the profiles settings page

  Scenario: Create a new profile
	When the user clicks on the "Add profile" button
	And fills the profile name with "Vegan Guest" and serving count with "2"
	And selects the dietary preference "Vegan"
	And saves the profile
	Then the profile "Vegan Guest" should appear in the profiles list

  Scenario: Edit dietary restrictions of an existing profile
	Given there is a profile named "My household" in the list
	When the user clicks to edit the profile "My household"
	And adds the allergy "Peanuts"
	And saves the profile changes
	Then the profile "My household" should display "Peanuts" in its allergies
    
  Scenario: Delete a profile that is not active
	Given there is an inactive profile named "My household"
	When the user clicks to delete the profile "My household"
	And confirms the profile deletion
	Then the profile "My household" should be removed from the list
	
  Scenario: Prevent deleting the active profile
	Given there is an active profile named "My household2"
	When the user tries to delete the active profile "My household2"
	Then the active profile "My household2" should remain in the list