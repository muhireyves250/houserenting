import { hash, verify } from "@node-rs/argon2";
import { COMMON_PASSWORDS } from "./common-passwords";

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane). Argon2id is the library default.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}
