@export-application-state @US-20
Feature: Export the saved application state
  As a user
  I want a structured JSON backup of my saved application data
  So that I own my data without relying on a server

  # Only profiles and pantry stock currently have persistence implementations.
  Scenario: Export every profile and pantry item without changing saved data
    Given the export page has saved profiles and pantry stock
    When I request a JSON data export
    Then the JSON download contains all saved profiles and pantry stock
    And exporting leaves device storage unchanged

  Scenario: Export on first launch
    Given the export page has no saved data
    When I request a JSON data export
    Then the JSON download contains empty profiles and pantry stock
    And exporting leaves device storage unchanged

  Scenario Outline: Do not download a partial backup when data cannot be read
    Given the export page has saved profiles and pantry stock
    And export storage is "<failure>"
    When I request a JSON data export
    Then an export error appears without a download
    And exporting leaves device storage unchanged

    Examples:
      | failure     |
      | invalid JSON |
      | unavailable |
