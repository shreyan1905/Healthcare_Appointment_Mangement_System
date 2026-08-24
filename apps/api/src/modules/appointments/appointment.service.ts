import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { Prisma, AppointmentStatus, NotificationType } from "@prisma/client";
import { enqueueNotification } from "../../jobs/notification.worker";

type BookInput = {
  patientId: string;
  doctorUserId: string;
  scheduledAt: string;
  symptoms?: string;
};

export async function bookAppointment(input: BookInput) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId: input.doctorUserId } });
  if (!profile) throw new AppError("Doctor not found", 404);

  const scheduledAt = new Date(input.scheduledAt);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          patientId: input.patientId,
          doctorProfileId: profile.id,
          scheduledAt,
          durationMinutes: profile.slotDurationMinutes,
          symptoms: input.symptoms,
          status: AppointmentStatus.BOOKED,
        },
      });

      // This insert is what actually prevents double-booking.
      // If another request already holds this doctor+time, this line throws.
      await tx.appointmentSlotLock.create({
        data: {
          doctorProfileId: profile.id,
          scheduledAt,
          appointmentId: appointment.id,
        },
      });

      const patient = await tx.user.findUnique({ where: { id: input.patientId } });
      const notifLog = await tx.notificationLog.create({
        data: {
          type: NotificationType.BOOKING_CONFIRMATION,
          recipientEmail: patient!.email,
          appointmentId: appointment.id,
        },
      });

      return { appointment, notifLogId: notifLog.id };
    });

    await enqueueNotification(result.notifLogId);
    return result.appointment;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("That slot was just booked by someone else. Please pick another time.", 409);
    }
    throw err;
  }
}

export async function cancelAppointment(appointmentId: string, requesterId: string) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) throw new AppError("Appointment not found", 404);
  if (appointment.patientId !== requesterId) {
    throw new AppError("You can only cancel your own appointments", 403);
  }
  if (appointment.status !== AppointmentStatus.BOOKED) {
    throw new AppError("This appointment cannot be cancelled", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date() },
    });
    await tx.appointmentSlotLock.deleteMany({ where: { appointmentId } });

    const patient = await tx.user.findUnique({ where: { id: requesterId } });
    const notifLog = await tx.notificationLog.create({
      data: {
        type: NotificationType.CANCELLATION,
        recipientEmail: patient!.email,
        appointmentId,
      },
    });

    return { updated, notifLogId: notifLog.id };
  });

  await enqueueNotification(result.notifLogId);
  return result.updated;
}

export async function listMyAppointments(patientId: string) {
  return prisma.appointment.findMany({
    where: { patientId },
    include: { doctorProfile: { include: { user: true } } },
    orderBy: { scheduledAt: "desc" },
  });
}
