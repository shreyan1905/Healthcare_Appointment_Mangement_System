import { Response, NextFunction } from "express";
import * as doctorService from "./doctor.service";
import { AuthenticatedRequest } from "../../middleware/authenticate";

export async function search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const doctors = await doctorService.searchDoctors(req.query.specialization as string);
    res.status(200).json(doctors);
  } catch (err) {
    next(err);
  }
}

export async function slots(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const date = req.query.date as string;
    if (!date) throw new Error("date query param is required (YYYY-MM-DD)");
    const available = await doctorService.getAvailableSlots(req.params.id, date);
    res.status(200).json({ date, availableSlots: available });
  } catch (err) {
    next(err);
  }
}

export async function myTodaysAppointments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const appointments = await doctorService.getTodaysAppointments(req.user!.userId);
    res.status(200).json(appointments);
  } catch (err) {
    next(err);
  }
}

export async function submitNotes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { doctorNotes, prescription } = req.body;
    if (!doctorNotes) throw new Error("doctorNotes is required");
    const updated = await doctorService.submitVisitNotes(
      req.user!.userId,
      req.params.appointmentId,
      doctorNotes,
      prescription
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}
