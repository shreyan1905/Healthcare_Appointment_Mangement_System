import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as appointmentController from "./appointment.controller";

const router = Router();

router.use(authenticate);

router.post("/", authorize("PATIENT"), appointmentController.book);
router.get("/me", authorize("PATIENT"), appointmentController.listMine);
router.patch("/:id/cancel", authorize("PATIENT"), appointmentController.cancel);

export default router;
