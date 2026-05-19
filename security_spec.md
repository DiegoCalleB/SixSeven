# Security Specification

## Data Invariants
1. A Game must have an `ownerId` set to the creator's UID.
2. A Player document must only be created by the user themselves (`request.auth.uid == userId`).
3. An Action document must only be created by the user themselves (`request.auth.uid == uid`).
4. An Action must have a server timestamp for `createdAt`.
5. An Action `cardValue` (if throw) must be between 1 and 10, pattern must be a string.

## The "Dirty Dozen" Payloads
1. Create Game with impersonated ownerId.
2. Create Game with invalid status ('hacked').
3. Create Player document for another user.
4. Update Game status as non-owner.
5. Create Action with impersonated UID.
6. Create Action with future/past client timestamp instead of server timestamp.
7. Create Action in a Game that doesn't exist.
8. Create Action with type that is not 'throw' or 'smash'.
9. Create Action with malicious large string payload.
10. Update an existing Action (Actions must be immutable).
11. Read Players or Actions for a Game without being authenticated.
12. Read Actions with a blanket list rule (must restrict to valid games).
