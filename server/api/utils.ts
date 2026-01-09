export function toSafeUser<T extends { passwordHash?: unknown }>(user: T) {
  if (!user) return user;
  const { passwordHash: _passwordHash, ...safeUser } = user as any;
  return safeUser as Omit<T, "passwordHash">;
}

