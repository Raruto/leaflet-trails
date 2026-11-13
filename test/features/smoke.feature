@smoke
Feature: Example smoke tests
  Scenario: The examples list is complete
    Then all HTML examples are listed

  Scenario: Development URLs are rewritten only in served HTML
    Then development pages rewrite CDN URLs without changing files

  Scenario Outline: An example loads without browser errors
    Then the example "<example>" loads without browser errors

    Examples:
      | example |
      | leaflet-trails.html |
      | leaflet-trails_grouped.html |
      | leaflet-trails_overlays.html |
      | leaflet-trails_pane.html |
      | leaflet-trails_simple.html |
      | leaflet-trails_ui.html |
