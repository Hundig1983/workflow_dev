# shopping-lists Specification (delta)

## ADDED Requirements

### Requirement: List management

The system SHALL let an authenticated family member create, rename, and delete named shopping lists
belonging to their family. A list name MUST be non-blank after trimming and at most 120 characters.
Every list response MUST carry the list's `updated_at`.

#### Scenario: A member creates a named list

- **WHEN** an authenticated member creates a list named "Groceries"
- **THEN** the list is created in that member's family and returned with its id, name, and `updated_at`

#### Scenario: A blank list name is rejected

- **WHEN** a member submits a list whose name is empty or only whitespace
- **THEN** the system rejects the request as a validation failure and no list is created

#### Scenario: Renaming a list is last-write-wins

- **GIVEN** two members rename the same list at nearly the same time
- **WHEN** both requests complete
- **THEN** the name from the later write stands, the earlier write is silently superseded, and the
  list's `updated_at` reflects the later write

#### Scenario: Deleting a list removes its items

- **GIVEN** a list containing items
- **WHEN** a member deletes the list
- **THEN** the list and all its items (checked, unchecked, and archived) cease to exist
- **AND** deleting the same list again is refused as not found without error side effects

### Requirement: Item lifecycle

The system SHALL let a member add items to a list (name required; quantity and note optional), edit an
item's name, quantity, or note, and delete an item. Item edits MUST resolve concurrent writes as
last-write-wins on `updated_at`; a delete MUST win over any concurrent edit. Every item response MUST
carry the item's `updated_at`.

#### Scenario: A member adds an item

- **WHEN** a member adds "Milk" with quantity "2L" to a list
- **THEN** the item appears in that list's unchecked group with its name, quantity, and `updated_at`

#### Scenario: Concurrent edits resolve last-write-wins

- **GIVEN** two members edit the same item's note at nearly the same time
- **WHEN** both requests complete
- **THEN** the note from the later write stands and no error is surfaced to either member

#### Scenario: Delete wins over a concurrent edit

- **GIVEN** one member deletes an item while another member is editing it
- **WHEN** the edit arrives after the delete
- **THEN** the item stays deleted and the late edit is refused as not found rather than recreating it

### Requirement: Idempotent check-off and uncheck

Checking an item SHALL mark it checked, recording when and by whom; unchecking SHALL return it to the
unchecked group. Both operations MUST be idempotent: repeating one MUST yield the same state with no
error and no duplicate effect.

#### Scenario: Checking an item marks it bought

- **WHEN** a member checks "Milk"
- **THEN** the item moves to the checked group, visibly distinct, and stays visible to every member

#### Scenario: Two members check the same item

- **GIVEN** two members check the same item at nearly the same time
- **WHEN** both requests complete
- **THEN** the item is checked exactly once, both requests succeed, and no duplicate effect occurs

#### Scenario: Unchecking restores an item

- **GIVEN** a checked item
- **WHEN** a member unchecks it
- **THEN** the item returns to the unchecked group; unchecking it again succeeds with no further change

### Requirement: Checked items stay visible until an explicit clear archives them

Checked items SHALL remain visible, grouped apart from unchecked ones, until a member explicitly clears
the list. Clearing SHALL archive the checked items — they leave the active view but are retained, not
destroyed. Clearing MUST NOT touch unchecked items and MUST be idempotent.

#### Scenario: Checked items remain visible to the whole family

- **GIVEN** a member checked "Milk"
- **WHEN** any family member views the list
- **THEN** "Milk" appears in the checked group rather than disappearing

#### Scenario: Clear archives only the checked items

- **GIVEN** a list with two checked items and one unchecked item
- **WHEN** a member clears the list
- **THEN** the two checked items are archived out of the active view, the unchecked item remains, and
  clearing again succeeds with no further change

### Requirement: Family isolation of lists and items

Family scope for every list and item operation SHALL be resolved server-side from the session. A member
MUST NOT be able to read or mutate another family's lists or items, and the refusal MUST NOT reveal
whether the target exists. Isolation MUST be proven by dedicated automated tests that fail if scoping is
removed from any new read or mutation path.

#### Scenario: Another family's list is unreachable

- **GIVEN** two families each with lists
- **WHEN** a member of one family addresses a list or item belonging to the other family by its id
- **THEN** the request is refused without revealing whether that id exists, and no data is returned or
  changed

### Requirement: Offline-ready contract

Every list and item response SHALL expose `updated_at`, and every mutation SHALL be either idempotent or
last-write-wins, so a future offline client can queue and replay mutations against unchanged API
semantics (ARCHITECTURE ADR: offline-ready without shipping offline). This change itself SHALL NOT ship
offline storage, realtime push, or notifications.

#### Scenario: Mutations are safe to replay

- **GIVEN** any check, uncheck, delete, or clear request that already succeeded
- **WHEN** the same request is replayed (as an offline queue would after reconnect)
- **THEN** the outcome is the state the first request produced, with no error and no duplicate effect
