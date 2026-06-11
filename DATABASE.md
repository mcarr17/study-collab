# Database Documentation

## Database Type

AI Study Collab uses Google Firestore, a NoSQL document database. Firestore stores data as collections of documents using a JSON-like structure.

## Collections

### Users

Stores registered user accounts.

Example:

```json
{
  "id": "user-123",
  "name": "John Doe",
  "email": "john@example.com",
  "passwordHash": "<hashed_password>"
}
```

Fields:

| Field        | Type   | Description            |
| ------------ | ------ | ---------------------- |
| id           | String | Unique user identifier |
| name         | String | Display name           |
| email        | String | User email             |
| passwordHash | String | Hashed password        |

---

### Groups

Stores study groups created by users.

Example:

```json
{
  "id": "group-456",
  "name": "CS144 Study Group",
  "course": "CS144",
  "ownerId": "user-123",
  "memberIds": ["user-123", "user-456"]
}
```

Fields:

| Field     | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| id        | String | Unique group identifier        |
| name      | String | Group name                     |
| course    | String | Associated course              |
| ownerId   | String | User who created the group     |
| memberIds | Array  | Members currently in the group |

---

### Notes

Stores notes associated with a study group.

Example:

```json
{
  "id": "note-789",
  "groupId": "group-456",
  "userId": "user-123",
  "author": "John Doe",
  "content": "These are study notes."
}
```

Fields:

| Field   | Type   | Description            |
| ------- | ------ | ---------------------- |
| id      | String | Unique note identifier |
| groupId | String | Associated group       |
| userId  | String | Author identifier      |
| author  | String | Author display name    |
| content | String | Note contents          |

## Relationships

* One user can create multiple groups.
* One group has exactly one owner.
* One group can contain multiple members.
* One group can contain multiple notes.
* Each note belongs to exactly one group.

## Security

Passwords are stored as hashes rather than plaintext. Access to protected resources requires authentication using JWT tokens.
