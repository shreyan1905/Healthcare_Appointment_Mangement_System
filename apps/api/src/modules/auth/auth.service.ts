import { prisma } from "../../lib/prisma";
import { hashPassword, comparePassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { AppError } from "../../utils/AppError";
import { Role } from "@prisma/client";

type RegisterInput = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const hashed = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashed,
      name: input.name,
      role: input.role,
    },
  });

  return issueTokens(user.id, user.role);
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  return issueTokens(user.id, user.role);
}

async function issueTokens(userId: string, role: Role) {
  const accessToken = signAccessToken({ userId, role });
  const refreshToken = signRefreshToken({ userId, role });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt },
  });

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(oldToken: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new AppError("Refresh token is invalid or expired", 401);
  }

  const payload = verifyRefreshToken(oldToken);

  await prisma.refreshToken.update({
    where: { token: oldToken },
    data: { revoked: true },
  });

  return issueTokens(payload.userId, payload.role);
}

export async function logoutUser(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data: { revoked: true },
  });
}
