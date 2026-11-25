@us-23 @recipe-card-missing-ingredients
Feature: US-23 Add missing ingredients directly from discovery cards
  As a user
  I want to push missing ingredients directly from recipe discovery cards to my shopping list with a single click
  So that I can easily acquire everything required for a dish

  Background:
    Given US-23 discovery has a pantry containing Tomato and fixed recipe results
    And the US-23 shopping list contains:
      | name | quantity | unit | checked |

  Scenario: Discovery cards identify missing ingredients and offer one transfer button
    When I search the US-23 discovery catalogue
    Then the US-23 card "Tomato rice" shows missing ingredients "Onion, Rice"
    And the US-23 card "Tomato soup" shows missing ingredients "Carrot"
    And each US-23 discovery card has one add-missing button
    And the US-23 shopping list contains exactly:
      | name | quantity | unit | checked |

  Scenario: One click transfers only the selected recipe's missing ingredients
    When I search the US-23 discovery catalogue
    And I click add missing once on the US-23 card "Tomato rice"
    Then the US-23 shopping list contains exactly:
      | name  | quantity | unit | checked |
      | Onion | 2        | un   | false   |
      | Rice  | 200      | g    | false   |
    And the US-23 pantry is unchanged
    When I open the US-23 shopping list page
    Then the US-23 shopping page shows exactly "Onion, Rice"
    When I reload the US-23 shopping list page
    Then the US-23 shopping page shows exactly "Onion, Rice"

  Scenario Outline: Existing shopping items are preserved without duplicates
    Given the US-23 shopping list contains:
      | name           | quantity | unit | checked   |
      | <existingName> | 5        | un   | <checked> |
      | Bread          | 1        | un   | false     |
    When I search the US-23 discovery catalogue
    And I click add missing once on the US-23 card "Tomato rice"
    Then the US-23 shopping list contains exactly:
      | name           | quantity | unit | checked   |
      | <existingName> | 5        | un   | <checked> |
      | Bread          | 1        | un   | false     |
      | Rice           | 200      | g    | false     |

    Examples:
      | existingName | checked |
      | Onion        | false   |
      | ONION        | false   |
      | onion        | true    |

  Scenario: Repeating the action does not duplicate transferred ingredients
    When I search the US-23 discovery catalogue
    And I click add missing once on the US-23 card "Tomato rice"
    And I click add missing once on the US-23 card "Tomato rice"
    Then the US-23 shopping list contains exactly:
      | name  | quantity | unit | checked |
      | Onion | 2        | un   | false   |
      | Rice  | 200      | g    | false   |

  Scenario: A different card transfers its own missing ingredients
    When I search the US-23 discovery catalogue
    And I click add missing once on the US-23 card "Tomato soup"
    Then the US-23 shopping list contains exactly:
      | name   | quantity | unit | checked |
      | Carrot | 1        | un   | false   |

  Scenario: A recipe with nothing missing leaves the shopping list unchanged
    Given the US-23 shopping list contains:
      | name  | quantity | unit | checked |
      | Bread | 1        | un   | false   |
    When I search the US-23 discovery catalogue
    Then the US-23 card "Fresh tomato" shows nothing missing
    When I click add missing once on the US-23 card "Fresh tomato"
    Then the US-23 shopping list contains exactly:
      | name  | quantity | unit | checked |
      | Bread | 1        | un   | false   |
