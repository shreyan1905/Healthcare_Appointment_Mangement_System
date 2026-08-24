import { Response, NextFunction } from "express";
import { z } from "zod";
import * as appointmentService from "./appointment.service";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { generatePreVisitSummary } from "../../lib/llm";
import { prisma } from "../../lib/prisma";

const bookSchema = z.object({
  doctorId: z.string().uuid(),
  scheduledAt: z.string(),
  symptoms: z.string().optional(),
});

export async function book(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = bookSchema.parse(req.body);
    const appointment = await appointmentService.bookAppointment({
      patientId: req.user!.userId,
      doctorUserId: data.doctorId,
      scheduledAt: data.scheduledAt,
      symptoms: data.symptoms,
    });

    if (data.symptoms) {
      const summary = await generatePreVisitSummary(data.symptoms);
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          urgencyLevel: summary.urgencyLevel as any,
          chiefComplaint: summary.chiefComplaint,
          suggestedQuestions: summary.suggestedQuestions,
        },
      });
    }

    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const appointment = await appointmentService.cancelAppointment(req.params.id, req.user!.userId);
    res.status(200).json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const appointments = await appointmentService.listMyAppointments(req.user!.userId);
    res.status(200).json(appointments);
  } catch (err) {
    next(err);
  }
}
