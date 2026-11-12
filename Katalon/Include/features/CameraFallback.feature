@tag
Feature: Camera Fallback Options (US-08)

  As a user
  I want an alternative if the camera doesn't work
  So that I can still add items to my pantry

  Background:
    Given the user is on the scanner page

  @us08-fallback
  Scenario: Camera permission denied shows upload and manual options
    When the user forces the fallback mode
    Then the camera area should be hidden
    And the fallback area should be visible
    And the upload and manual options should be displayed

  @us08-fallback
  Scenario: Add item through manual entry
    When the user forces the fallback mode
    And the user enters a valid barcode manually "5449000000996"
    Then the item form should be auto-filled with product details

  @us08-fallback
  Scenario: Add item through image upload
    When the user forces the fallback mode
    And uploads a barcode image file
    Then the item form should open with the barcode filled from the image