import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    logger.warn(`${err.statusCode} - ${err.message}`);
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
  }

  logger.error("Unexpected error", { error: err.message, stack: err.stack });
  return res.status(500).json({
    status: "error",
    message: "Something went wrong. Please try again later.",
  });
}
