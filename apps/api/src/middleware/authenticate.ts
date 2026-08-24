import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JwtPayload } from "../utils/jwt";
import { AppError } from "../utils/AppError";

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    next(new AppError("Invalid or expired access token", 401));
  }
}
