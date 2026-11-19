Feature: Add missing ingredients to shopping list
  As a user
  I want to push missing ingredients from a recipe card to my list in one click
  So that I don't retype them

  Background:
    Given I am on the recipes page
    And my pantry has the ingredient "Tomato"
    And my shopping list is empty

  Scenario: Successfully add missing ingredients
    When I click on "Procurar Receitas"
    And I click on "Adicionar Ingredientes em Falta" on the first recipe
    Then I accept the confirmation alert
    And I navigate to the shopping list page
    Then the shopping list should not be empty

  Scenario: Do not add ingredients already in stock
    When I click on "Procurar Receitas"
    And I click on "Adicionar Ingredientes em Falta" on a recipe that uses "Tomato"
    Then I accept the confirmation alert
    And I navigate to the shopping list page
    Then I should NOT see the ingredient "Tomato" in the shopping list