@tag
Feature: Recipe Discovery from Pantry

  As a user
  I want to see recipes based on my pantry stock
  So that I can cook with what I have

  Background:
    Given the user is on the recipes page

  Scenario: Find recipes with available ingredients
    Given the user has products in the pantry
    When the user clicks the search recipes button
    Then the system should display recipe cards
    And the recipe cards should show the progress bar

  Scenario: Handle empty pantry gracefully
    Given the user has an empty pantry
    When the user clicks the search recipes button
    Then the system should display an empty state message
    
  Scenario: Rank recipes with expiring items first
    Given the user has a product expiring soon in the pantry
    When the user clicks the search recipes button
    Then the first recipe card should show the expiry warning