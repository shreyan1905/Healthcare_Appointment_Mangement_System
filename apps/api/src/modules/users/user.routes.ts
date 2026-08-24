import { Router, Response } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/authenticate";

const router = Router();

router.get("/me", authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({ user: req.user });
});

export default router;
