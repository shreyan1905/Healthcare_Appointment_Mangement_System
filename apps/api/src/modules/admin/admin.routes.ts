import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as adminController from "./admin.controller";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.post("/doctors", adminController.create);
router.get("/doctors", adminController.list);
router.get("/doctors/:id", adminController.getOne);
router.patch("/doctors/:id", adminController.update);
router.put("/doctors/:id/working-hours", adminController.setHours);
router.post("/doctors/:id/leaves", adminController.createLeave);
router.get("/doctors/:id/leaves", adminController.getLeaves);

export default router;
