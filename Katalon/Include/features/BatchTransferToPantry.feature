Feature: Batch Transfer from Shopping List to Pantry

  As a user
  I want to batch-transfer checked items straight from the shopping list into my pantry inventory with custom quantities, categories, and expiration dates
  So that I can update my stock quickly after shopping

  Scenario: Batch-transfer checked items with custom quantity, category, and expiration date
	Given the shopping list contains checked items "Leite" and "Arroz" and unchecked item "Maçãs"
	And the pantry inventory is empty
	When the user opens batch transfer for checked items
	And sets custom quantity "3", category "Laticínios", and expiry "2026-12-15" for the first item
	And sets custom quantity "2", category "Mercearia", and expiry "2027-06-01" for the second item
	And confirms the batch transfer
	Then the pantry inventory should contain "Leite" with quantity "3", category "Laticínios", and expiry "2026-12-15"
	And the pantry inventory should contain "Arroz" with quantity "2", category "Mercearia", and expiry "2027-06-01"
	And the shopping list should only contain "Maçãs"

  Scenario: Preventing batch transfer when no items are checked
	Given the shopping list contains only unchecked item "Pão"
	When the user attempts to open batch transfer
	Then an alert message should indicate that no items are selected