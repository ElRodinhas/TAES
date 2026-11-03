@initial-household-setup
Feature: Initial household setup
  As a new user
  I want to create my default household profile on first launch
  So that recipes fit my diet and household size

  Background:
    Given I open Smart Pantry with no saved households

  @AC1
  Scenario: Complete onboarding with valid profile data
    Given the onboarding screen is visible
    When I enter "Test home" as the household name
    And I enter "3" as the serving count
    And I select "vegetarian" as the dietary lifestyle
    And I select "Peanuts" as a food allergy
    And I enter "mushrooms, coriander" as excluded ingredients
    And I save the household profile
    Then the household management screen should be visible
    And the active household should be named "Test home"
    And the active household summary should be "3 servings · Vegetarian"
    And the household card should list allergy "Peanuts" and excluded ingredients "mushrooms, coriander"

  @AC2
  Scenario: Skip onboarding after household setup has been completed
    Given I have saved a household named "Test home" with 3 servings
    When I reload the Smart Pantry application
    Then the household management screen should be visible
    And the onboarding screen should not be visible
    And the active household should be named "Test home"

  @AC3
  Scenario: Cannot finish onboarding without a serving count
    Given the onboarding screen is visible
    When I leave the serving count empty
    And I attempt to save the household profile
    Then the onboarding screen should be visible
    And I should see the serving count error "Enter a whole number between 1 and 30."
    And no household profile should be stored

  @AC3
  Scenario Outline: Invalid serving counts cannot finish onboarding
    Given the onboarding screen is visible
    When I enter "<servings>" as the serving count
    And I attempt to save the household profile
    Then the onboarding screen should be visible
    And I should see the serving count error "Enter a whole number between 1 and 30."
    And no household profile should be stored

    Examples:
      | servings |
      | 0        |
      | 31       |
      | 2.5      |

  @multiple-households
  Scenario: Create a second household without changing the default
    Given I have saved a household named "Test home" with 3 servings
    When I add a household named "Guests" with 2 servings
    Then I should see 2 household cards
    And the active household should be named "Test home"
