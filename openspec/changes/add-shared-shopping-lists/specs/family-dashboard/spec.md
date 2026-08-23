# family-dashboard Specification (delta)

## MODIFIED Requirements

### Requirement: Explicit empty state

The dashboard SHALL represent "this family has no content yet" as an explicit, successful state, distinct
from an error or an unavailable state. The client MUST render that state as a deliberate empty view rather
than a blank screen or a failure. Once the family has shopping lists, the dashboard's `shopping` section
SHALL carry one summary per list (id, name, count of unchecked items) and the dashboard's `isEmpty` MUST
be false. A family whose lists exist but contain no unchecked items is NOT empty — the client
distinguishes "no lists yet" from "lists exist and everything is done".

#### Scenario: A newly created family shows an explicit empty state

- **GIVEN** a member has just registered and their family contains no content
- **WHEN** they retrieve the dashboard
- **THEN** the system returns a successful response describing an empty family
- **AND** the client displays a recognisable empty state rather than a blank or error screen

#### Scenario: Empty is distinguishable from unavailable

- **WHEN** the dashboard cannot be retrieved because of an error
- **THEN** the client presents that failure differently from the empty state
- **AND** a member can tell whether their family has no content or the information could not be loaded

#### Scenario: Shopping lists appear on the dashboard

- **GIVEN** the family has a list "Groceries" with two unchecked items
- **WHEN** a member retrieves the dashboard
- **THEN** the `shopping` section contains a summary for "Groceries" with an unchecked count of 2
- **AND** the dashboard is no longer reported as empty
