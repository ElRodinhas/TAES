@generate-recipes @US15
Feature: Generate and save recipes from leftovers
  As a user
  I want original recipes from leftover ingredients
  So that I can find meals when catalogue searches are insufficient

  Background:
    Given the generator has an active vegan profile for 2 portions and pantry tomatoes

  Scenario: Combine pantry and manual ingredients using the active profile
    Given the recipe service returns a structured recipe
    When I select pantry tomatoes and enter leftover rice
    And I request a recipe for 3 portions
    Then the generation request includes both ingredients and the profile restrictions
    And a Portuguese recipe shows times, 3 portions, measurements and numbered steps
    When I save the generated recipe and reload
    Then the saved recipe is still available without contacting the recipe service

  Scenario: Ask permission before allowing missing ingredients
    Given the recipe service cannot use only the supplied ingredients
    When I select pantry tomatoes and enter leftover rice
    And I request a recipe for 3 portions
    Then the generator asks permission to suggest missing ingredients
    When I allow missing ingredients
    Then the recipe marks the missing ingredients

  Scenario Outline: Preserve inputs when generation fails
    Given the recipe service fails with "<code>"
    When I select pantry tomatoes and enter leftover rice
    And I request a recipe for 3 portions
    Then the generator shows an error and preserves my ingredients

    Examples:
      | code            |
      | OFFLINE         |
      | TIMEOUT         |
      | QUOTA           |
      | BLOCKED         |
      | INVALID_RECIPE  |
      | RESTRICTION     |

  Scenario: Require ingredients before calling the service
    Given the recipe service returns a structured recipe
    When I request a recipe for 3 portions
    Then the generator shows an error without calling the service

  Scenario: Require a valid household on first launch
    Given the generator has no household profile
    When I request a recipe for 3 portions
    Then the generator shows an error without calling the service

  Scenario: Report a device storage failure
    Given the recipe service returns a structured recipe
    When I select pantry tomatoes and enter leftover rice
    And I request a recipe for 3 portions
    And recipe saving is unavailable on this device
    And I save the generated recipe
    Then the generator reports that the recipe could not be saved
