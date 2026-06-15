# Security Specification & Test Suites for Expiry Product Return Notes

## 1. Data Invariants
1. A return note can only be created by an authenticated and verified user.
2. The `creatorId` on a return note must match the authenticated user's ID (`request.auth.uid`).
3. An item in a return note can only be created if the parent return note exists and is owned by the same user.
4. Timestamps (`createdAt`, `updatedAt`) must be strictly set to the server timestamp (`request.time`).
5. A return note cannot be modified (status or items) once its status is set to `completed` (terminal state locking).
6. Document IDs for return notes and items must be well-formed alphanumeric strings (`isValidId`).
7. Numbers like product quantity must be positive integers (`quantity > 0`).

## 2. The "Dirty Dozen" Payloads (Deny List)
The following payloads are designed to breach identity, integrity, and state bounds, and must be rejected:
1. **Creation without authentication** — Attempting to write a note without being logged in.
2. **Identity spoofing** — Attempting to create a note where `creatorId` does not match `request.auth.uid`.
3. **Email unverified exploit** — Setting `email_verified` to `false` in context but trying to write anyway.
4. **Invalid document ID poisoning** — Using a 2KB junk string as the return note's ID.
5. **Negative quantity injection** — Creating a return item with `quantity: -100` or `quantity: 0`.
6. **Ghost field injection (Shadow Update)** — Updating a note and trying to inject a field like `isAdmin: true`.
7. **Bypassing Server Timestamps on Creation** — Sending a client-side timestamp instead of `request.time` for `createdAt`.
8. **Bypassing Server Timestamps on Update** — Sending a stale or client timestamp for `updatedAt`.
9. **Stale/Terminal State Modification** — Trying to add an item or alter a note whose status is already `completed`.
10. **Orphaned Item Creation** — Creating an item under a non-existent return note ID or a note owned by another user.
11. **Modifying Immortal Fields** — Trying to change `creatorId` or `createdAt` on an existing note.
12. **Blanket Query Scraping** — Querying all return notes across the database without a filter on `creatorId`.
