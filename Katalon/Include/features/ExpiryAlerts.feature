@expiry-alerts @US-06
Feature: Highlight pantry items expiring within 48 hours
  As a user
  I want items expiring within 48 hours highlighted
  So that I use them first

  # The current expiry field stores YYYY-MM-DD, without a time of day.
  # For these date-based acceptance tests, 24/48 hours means 1/2 calendar days ahead.
  # Dates are calculated in the browser's local timezone, never hardcoded.
  Scenario: Item expiring in 24 hours appears in the alert tray
    Given the expiry alerts pantry contains "Milk" expiring in 24 hours and "Rice" expiring in 5 days
    When I open the pantry to check expiry alerts
    Then the expiry alert tray is visible
    And "Milk" appears in the expiry alert tray

  Scenario: Item expiring in 5 days does not appear in the alert tray
    Given the expiry alerts pantry contains "Milk" expiring in 24 hours and "Rice" expiring in 5 days
    When I open the pantry to check expiry alerts
    Then the expiry alert tray is visible
    And "Milk" appears in the expiry alert tray
    And "Rice" does not appear in the expiry alert tray
    And both expiry test items remain visible in the pantry inventory

  Scenario Outline: Items within the 48-hour window have a visible expiry highlight
    Given the expiry alerts pantry contains "Milk" expiring in <hours> hours and "Rice" expiring in 5 days
    When I open the pantry to check expiry alerts
    Then the soon-expiring pantry item has a visible expiry highlight
    And the pantry item expiring in 5 days has no expiry highlight

    Examples:
      | hours |
      | 24    |
      | 48    |
