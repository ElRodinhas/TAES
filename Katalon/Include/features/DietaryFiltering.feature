@tag
Feature: Dietary Filtering for Recipe Suggestions

	As a user with dietary needs
	I want unsuitable recipes hidden
	So that I only see safe options

  Scenario: Recipe containing an allergen is hidden
	Given the active profile has allergy "Milk"
	And the pantry contains "pasta, tomato, cheese"
	When the user searches for recipes
	Then no displayed recipe should contain "cheese" or "milk"

  Scenario: Non-vegan recipe is hidden for a vegan profile
	Given the active profile has dietary lifestyle "vegan"
	And the pantry contains "pasta, tomato, cheese, egg"
	When the user searches for recipes
	Then no displayed recipe should contain "cheese", "milk", or "egg"

  Scenario: Recipe with an excluded ingredient is hidden
	Given the active profile excludes the ingredient "garlic"
	And the pantry contains "pasta, tomato, garlic"
	When the user searches for recipes
	Then no displayed recipe should contain "garlic"