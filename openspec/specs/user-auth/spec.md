# user-auth Specification

## Purpose
TBD - created by archiving change add-auth-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Account registration

The system SHALL allow a person to register an account using an email address and a password. The email
address MUST be unique across all accounts. The password MUST be stored using a salted, memory-hard
password-hashing function; the plaintext password MUST NOT be persisted, logged, or included in any
response.

#### Scenario: Successful registration

- **WHEN** an unauthenticated caller submits a well-formed, previously unused email address and a password
  meeting the minimum strength policy
- **THEN** the system creates an account, and responds indicating success without returning the password
  or its hash

#### Scenario: Duplicate email is rejected

- **WHEN** a caller submits an email address that already belongs to an account
- **THEN** the system rejects the request with a client error and creates no account
- **AND** the response does not reveal whether the address belongs to an existing account beyond the
  generic rejection

#### Scenario: Malformed or weak input is rejected

- **WHEN** a caller submits a malformed email address, or a password below the minimum strength policy
- **THEN** the system rejects the request with a validation error naming the offending field
- **AND** creates no account

#### Scenario: Plaintext password is never retained

- **WHEN** an account has been created
- **THEN** no stored record, log entry, or API response contains the plaintext password
- **AND** the stored credential is a salted hash from which the password cannot be recovered

### Requirement: Credential verification and session issuance

The system SHALL verify submitted credentials server-side and, on success, issue a session token that
authenticates subsequent requests. The token MUST be unguessable, MUST carry an expiry, and MUST be
retained by the system only in hashed form.

#### Scenario: Successful login

- **WHEN** a caller submits credentials matching an existing account
- **THEN** the system issues a session token with an expiry timestamp
- **AND** the caller can use that token to authenticate subsequent requests

#### Scenario: Invalid credentials are rejected indistinguishably

- **WHEN** a caller submits an unknown email address, or a known address with an incorrect password
- **THEN** the system rejects the request with the same generic authentication failure in both cases
- **AND** issues no session token

#### Scenario: Session token is stored only as a hash

- **WHEN** a session has been issued
- **THEN** the system's stored session record contains a hash of the token, not the token itself
- **AND** a reader of the stored data cannot reconstruct a usable token from it

### Requirement: Authentication of subsequent requests

The system SHALL authenticate every non-public request by resolving the presented session token
server-side. Authentication state MUST NOT be inferred from any client-supplied claim other than the
token itself.

#### Scenario: Valid session authenticates the caller

- **WHEN** a caller presents an unexpired, unrevoked session token on a protected endpoint
- **THEN** the system resolves the token to its owning account server-side and processes the request as
  that account

#### Scenario: Missing or unrecognized token is rejected

- **WHEN** a caller presents no token, a malformed token, or a token matching no session record
- **THEN** the system rejects the request as unauthenticated and performs no side effects

#### Scenario: Expired session is rejected

- **WHEN** a caller presents a token whose session has passed its expiry timestamp
- **THEN** the system rejects the request as unauthenticated
- **AND** treats the session as no longer valid for any future request

### Requirement: Session revocation

The system SHALL allow an authenticated caller to revoke their current session, and revocation MUST take
effect immediately server-side.

#### Scenario: Logout revokes the current session

- **WHEN** an authenticated caller requests logout
- **THEN** the system revokes the session associated with the presented token

#### Scenario: Revoked token no longer authenticates

- **WHEN** a caller presents a token whose session has been revoked
- **THEN** the system rejects the request as unauthenticated, regardless of the token's expiry timestamp

