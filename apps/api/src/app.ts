import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./config/logger";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";
import adminRoutes from "./modules/admin/admin.routes";
import doctorRoutes from "./modules/doctors/doctor.routes";
import appointmentRoutes from "./modules/appointments/appointment.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1/doctors", doctorRoutes);
  app.use("/api/v1/appointments", appointmentRoutes);

  app.use((req, res) => {
    res.status(404).json({ status: "error", message: "Route not found" });
  });

  app.use(errorHandler);

  return app;
}
