# DayLock Security Specification

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}` and its subcollections (`trades`, `days`, `lifeGoals`) belongs exclusively to `request.auth.uid == userId` with verified email (`request.auth.token.email_verified == true`).
2. **Identity Integrity**: `userId` inside every document must match both `request.auth.uid` and the `{userId}` path parameter, and remain immutable after creation.
3. **Immutable Creation Timestamps**: `createdAt` must equal `request.time` on creation and never change on update; `updatedAt` must equal `request.time` on both create and update.
4. **Master Gate**: Subcollection writes (`trades`, `days`, `lifeGoals`) verify the parent `/users/{userId}` workspace document exists (via `exists()` or `existsAfter()` during initial sync batches).
5. **Strict Schema & Bounds**: Every string field has explicit `.size()` bounds; arrays (`rules`, `checks`, `milestones`) have strict `.size() <= 25` limits; shadow/unknown fields are rejected via `hasOnly()`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated read/write on `/users/u1/trades/t1` -> `PERMISSION_DENIED`
2. Unverified email write on `/users/u1` -> `PERMISSION_DENIED`
3. Cross-user read/list on `/users/u2/lifeGoals` while signed in as `u1` -> `PERMISSION_DENIED`
4. Spoofed `userId` in payload (`userId: "u2"`) under `/users/u1/trades/t1` -> `PERMISSION_DENIED`
5. Oversized ID (`tradeId` > 128 chars or invalid chars) -> `PERMISSION_DENIED`
6. Shadow field injection (`isAdmin: true`) on `/users/u1` -> `PERMISSION_DENIED`
7. Client-forged `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`
8. Mutating `createdAt` or `userId` on update -> `PERMISSION_DENIED`
9. Oversized `note` (> 1000 chars) or `title` (> 120 chars) -> `PERMISSION_DENIED`
10. Unbounded array (`milestones.size() > 20` or `rules.size() > 20`) -> `PERMISSION_DENIED`
11. Invalid `side` (`"Long"` instead of `"Buy"|"Sell"`) on Trade -> `PERMISSION_DENIED`
12. Invalid `deadline` format (`"tomorrow"` instead of `YYYY-MM-DD`) on LifeGoal -> `PERMISSION_DENIED`
