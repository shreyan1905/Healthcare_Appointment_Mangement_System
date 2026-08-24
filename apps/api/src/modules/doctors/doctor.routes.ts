import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as doctorController from "./doctor.controller";

const router = Router();

router.get("/", authenticate, doctorController.search);
router.get("/:id/slots", authenticate, doctorController.slots);
router.get("/me/appointments/today", authenticate, authorize("DOCTOR"), doctorController.myTodaysAppointments);
router.patch("/appointments/:appointmentId/notes", authenticate, authorize("DOCTOR"), doctorController.submitNotes);

export default router;
