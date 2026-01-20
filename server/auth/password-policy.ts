import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida senha com regras robustas:
 * - Minimo 8 caracteres
 * - Pelo menos 1 letra maiuscula
 * - Pelo menos 1 numero
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Senha deve ter no minimo 8 caracteres");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Senha deve conter pelo menos 1 letra maiuscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Senha deve conter pelo menos 1 numero");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
