## Purpose

Models the family as a tenant boundary and records who belongs to it in what role, then resolves a
caller's family scope server-side from their authenticated session. This capability is the enforcement
point for family-data isolation — the boundary every family-scoped read and write in the product depends
on.

## ADDED Requirements

### Requirement: Family creation on registration

The system SHALL create exactly one family when an account is registered, and SHALL record the registrant
as a member of that family with the parent/administrator role. Account creation and family creation MUST
succeed or fail together.

#### Scenario: Registration produces a family with an administrator

- **WHEN** a person completes registration
- **THEN** the system creates a family and records the new account as a member of it with the
  parent/administrator role
- **AND** the account is immediately able to act within that family without any further setup step

#### Scenario: Family creation is atomic with account creation

- **WHEN** any part of registration fails after the account record is written but before membership is
  established
- **THEN** the system persists neither the account, nor the family, nor the membership
- **AND** the email address remains available for a later registration attempt

### Requirement: Server-side family scope resolution

The system SHALL derive the family scope of every family-scoped request from the caller's authenticated
session server-side. A family identifier supplied by the client MUST NOT be used to widen or change the
caller's scope.

#### Scenario: Scope is derived from the session

- **WHEN** an authenticated caller requests a family-scoped resource
- **THEN** the system determines the applicable family from the caller's membership records, resolved
  server-side from the session

#### Scenario: Client-supplied family identifier cannot widen scope

- **WHEN** a caller includes a family identifier in a request that does not match a family they belong to
- **THEN** the system does not serve data for that family
- **AND** rejects the request rather than silently falling back to the caller's own family

### Requirement: Cross-family data isolation

The system SHALL prevent any account from reading or modifying the data of a family it does not belong
to. This isolation MUST be enforced in the backend, MUST NOT depend on client-side filtering, and MUST be
covered by dedicated automated tests.

#### Scenario: A member of one family cannot read another family's data

- **GIVEN** two families exist, each with its own member
- **WHEN** the member of the first family requests a resource belonging to the second family
- **THEN** the system denies the request and returns no data belonging to the second family

#### Scenario: Isolation holds without client cooperation

- **WHEN** a caller issues a request crafted to bypass client-side filtering, addressing another family's
  resource directly
- **THEN** the backend still denies the request, because the family scope was resolved from the session
  rather than from the request

#### Scenario: Isolation is verified by dedicated automated tests

- **WHEN** the automated test suite runs
- **THEN** it includes tests that specifically assert cross-family access is denied
- **AND** those tests fail if family scoping is removed from any family-scoped read path
