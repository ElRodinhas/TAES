Feature: Manual Grocery Management
  As a user
  I want to manually add, edit, or remove items from my shopping list
  So that I can keep track of what I need to buy

  Background:
    Given the user is on the shopping list page
    And the shopping list is empty

  Scenario: Add a new item manually
    When the user adds an item with name "Pão" and quantity 2
    Then the item "Pão" should appear in the list with quantity 2

  Scenario: Edit an existing item
    Given the shopping list has an item "Pão" with quantity 2
    When the user edits the item to name "Pão de Forma" and quantity 1
    Then the item "Pão de Forma" should appear with quantity 1

  Scenario: Remove an item
    Given the shopping list has an item "Pão" with quantity 2
    When the user removes the item "Pão"
    Then the shopping list should be empty

  Scenario: Mark an item as purchased
    Given the shopping list has an item "Pão" with quantity 2
    When the user marks the item "Pão" as purchased
    Then the item "Pão" should be checked