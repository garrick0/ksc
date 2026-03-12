// User service — handles gRPC requests for user operations.
// This file demonstrates CORRECT protobuf getter usage throughout.

import { User, UserProfile, UpdateUserRequest, UpdateUserResponse } from './user_pb';

// ── Correct: always use getter/setter methods ──────────────────────

export function handleGetUser(userId: string): User {
  const user = new User();
  user.setName('Alice');
  user.setEmail('alice@example.com');
  user.setAge(30);
  user.setRole('admin');
  return user;
}

export function handleUpdateUser(request: UpdateUserRequest): UpdateUserResponse {
  const response = new UpdateUserResponse();
  const userId = request.getUserId();
  const user = request.getUser();

  if (!user) {
    response.setSuccess(false);
    response.setMessage('User payload is required');
    return response;
  }

  // Correct: reading via getter
  const name = user.getName();
  const email = user.getEmail();

  // Correct: nested protobuf access via getter
  const profile = user.getProfile();
  if (profile) {
    const bio = profile.getBio();
    const avatar = profile.getAvatarUrl();
    console.log(`Updating profile: bio=${bio}, avatar=${avatar}`);
  }

  // Correct: field mask via getter
  const fields = request.getFieldMaskList();
  console.log(`Updating fields: ${fields.join(', ')} for user ${userId}`);

  response.setSuccess(true);
  response.setMessage(`Updated user ${name} (${email})`);
  return response;
}

// Correct: toObject() is the escape hatch — accessing plain object fields is fine
export function userToJson(user: User): string {
  const obj = user.toObject();
  return JSON.stringify({
    displayName: obj.name,
    contactEmail: obj.email,
    userAge: obj.age,
  });
}

// Correct: serialize/deserialize are method calls
export function cloneUser(user: User): User {
  const bytes = user.serializeBinary();
  return User.deserializeBinary(bytes);
}
