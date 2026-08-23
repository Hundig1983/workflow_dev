## Purpose

The authenticated landing surface a member sees after logging in: a family-scoped view summarising what
is happening in their family. In this change it is deliberately empty, and it exists as the attachment
point that later feature areas — calendar, tasks, shopping lists, location — will contribute sections to.

## ADDED Requirements

### Requirement: Authenticated dashboard retrieval

The system SHALL provide an authenticated member with a dashboard scoped to the family they belong to.
The dashboard MUST identify the family it describes, and MUST be refused to unauthenticated callers.

#### Scenario: A member retrieves their own family's dashboard

- **WHEN** an authenticated member requests the dashboard
- **THEN** the system returns a dashboard identifying the family that member belongs to

#### Scenario: Unauthenticated request is refused

- **WHEN** a caller requests the dashboard without a valid session
- **THEN** the system refuses the request as unauthenticated and returns no family data

#### Scenario: Dashboard never exposes another family's content

- **GIVEN** more than one family exists in the system
- **WHEN** an authenticated member retrieves the dashboard
- **THEN** the returned content contains no data belonging to any family other than their own

### Requirement: Explicit empty state

The dashboard SHALL represent "this family has no content yet" as an explicit, successful state, distinct
from an error or an unavailable state. The client MUST render that state as a deliberate empty view rather
than a blank screen or a failure.

#### Scenario: A newly created family shows an explicit empty state

- **GIVEN** a member has just registered and their family contains no content
- **WHEN** they retrieve the dashboard
- **THEN** the system returns a successful response describing an empty family
- **AND** the client displays a recognisable empty state rather than a blank or error screen

#### Scenario: Empty is distinguishable from unavailable

- **WHEN** the dashboard cannot be retrieved because of an error
- **THEN** the client presents that failure differently from the empty state
- **AND** a member can tell whether their family has no content or the information could not be loaded
