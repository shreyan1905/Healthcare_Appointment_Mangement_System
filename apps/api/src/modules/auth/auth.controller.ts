import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "./auth.service";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
  role: z.enum(["PATIENT", "DOCTOR", "ADMIN"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const tokens = await authService.registerUser(data);
    res.status(201).json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const tokens = await authService.loginUser(email, password);
    res.status(200).json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new Error("refreshToken is required");
    const tokens = await authService.refreshAccessToken(refreshToken);
    res.status(200).json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    await authService.logoutUser(refreshToken);
    res.status(200).json({ status: "ok", message: "Logged out" });
  } catch (err) {
    next(err);
  }
}
