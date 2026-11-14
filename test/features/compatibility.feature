Feature: Waymarked Trails compatibility
  Scenario Outline: Route layers work with supported Leaflet versions
    Then the "<bundle>" trails bundle works with Leaflet "<version>"

    Examples:
      | bundle   | version      |
      | readable | 1.9.4        |
      | minified | 1.9.4        |
      | readable | 2.0.0-beta.3 |
      | minified | 2.0.0-beta.3 |

  Scenario: Trail click feedback and concurrent requests
    Then trail clicks show results, errors and ignore stale responses
