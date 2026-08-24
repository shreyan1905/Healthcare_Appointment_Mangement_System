import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authenticate";
import { AppError } from "../utils/AppError";

export function authorize(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action", 403));
    }
    next();
  };
}
