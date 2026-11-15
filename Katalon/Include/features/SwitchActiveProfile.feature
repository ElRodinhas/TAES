@switch-active-profile
Feature: Switch the active profile from the dashboard header
  As a household member
  I want to switch profiles from the dashboard header
  So that suggestions match whoever is eating

  # AC2 depends on recipe results, which are not yet implemented.
  # Shopping-list UI is outside this story; unrelated stored data is protected.

  @AC1 @AC3
  Scenario: Switch profiles while keeping shared device data
    Given the profile dashboard has two saved profiles and shared device data
    When I choose "Guests" in the dashboard header
    Then the dashboard header and active card show "Guests"
    And the active household summary should be "2 servings · Vegan"
    And the saved active profile is "guests"
    And shared device data and saved profile preferences are unchanged
    When I reload the Smart Pantry application
    Then the dashboard header and active card show "Guests"
    When I choose "Family" in the dashboard header
    Then the dashboard header and active card show "Family"
    And shared device data and saved profile preferences are unchanged

  @storage-failure
  Scenario: Keep the active profile when saving fails
    Given the profile dashboard has two saved profiles and shared device data
    And profile switching cannot write to device storage
    When I choose "Guests" in the dashboard header
    Then the dashboard header and active card show "Family"
    And the saved active profile is "family"
    And a profile switching storage error is visible
    And shared device data and saved profile preferences are unchanged

  Scenario: First launch does not offer profile switching
    Given the profile dashboard has no saved profiles
    Then the onboarding screen should be visible
    And the dashboard profile switcher is hidden

  Scenario: One profile remains selected
    Given the profile dashboard has only one saved profile
    Then the dashboard header and active card show "Family"
    And the dashboard header offers one profile

  @AC1 @AC3
  Scenario Outline: Switch from another page and retain the selection across navigation
    Given the profile dashboard has two saved profiles and shared device data
    When I visit the "<page>" app page
    And I choose "Guests" in the dashboard header
    Then the page header shows profile "Guests"
    And the saved active profile is "guests"
    And shared device data and saved profile preferences are unchanged
    When I reload the Smart Pantry application
    Then the page header shows profile "Guests"
    When I visit the "index.html" app page
    Then the dashboard header and active card show "Guests"

    Examples:
      | page        |
      | pantry.html |
      | scan.html   |

  @storage-failure
  Scenario Outline: A failed switch on another page preserves the active profile
    Given the profile dashboard has two saved profiles and shared device data
    When I visit the "<page>" app page
    Given profile switching cannot write to device storage
    When I choose "Guests" in the dashboard header
    Then the page header shows profile "Family"
    And a profile switching storage error is visible
    And the saved active profile is "family"
    And shared device data and saved profile preferences are unchanged

    Examples:
      | page        |
      | pantry.html |
      | scan.html   |
