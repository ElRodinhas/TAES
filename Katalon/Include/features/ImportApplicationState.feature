@import-application-state
Feature: Restore an exported application backup
  As a user
  I want to import my exported JSON file
  So that I can restore my profiles and pantry stock on this device

  Scenario Outline: Restore a backup and refresh the active profile
    Given the import page has "<state>" device data
    When I select a valid exported JSON file and confirm replacement
    Then the imported profiles and pantry stock replace the saved data
    And the imported active profile is shown after reload
    And unrelated device data is preserved by import

    Examples:
      | state    |
      | existing |
      | empty    |

  Scenario: Cancel replacement
    Given the import page has "existing" device data
    When I select a valid exported JSON file and cancel replacement
    Then importing leaves device storage unchanged

  Scenario Outline: Reject a bad backup before changing data
    Given the import page has "existing" device data
    When I select an import file with "<problem>"
    Then an import error is visible
    And importing leaves device storage unchanged

    Examples:
      | problem             |
      | invalid JSON        |
      | unsupported version |
      | missing section     |
      | invalid profile     |
      | invalid pantry item |

  Scenario: Restore previous data if saving the second section fails
    Given the import page has "existing" device data
    And importing pantry stock cannot write to device storage
    When I select a valid exported JSON file and confirm replacement
    Then an import error is visible
    And importing leaves device storage unchanged
