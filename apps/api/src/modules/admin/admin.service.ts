import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../utils/password";
import { AppError } from "../../utils/AppError";
import { AppointmentStatus, NotificationType } from "@prisma/client";
import { enqueueNotification } from "../../jobs/notification.worker";

type CreateDoctorInput = {
  email: string;
  password: string;
  name: string;
  specialization: string;
  bio?: string;
  slotDurationMinutes?: number;
};

export async function createDoctor(input: CreateDoctorInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const hashed = await hashPassword(input.password);

  const doctor = await prisma.user.create({
    data: {
      email: input.email,
      password: hashed,
      name: input.name,
      role: "DOCTOR",
      doctorProfile: {
        create: {
          specialization: input.specialization,
          bio: input.bio,
          slotDurationMinutes: input.slotDurationMinutes ?? 30,
        },
      },
    },
    include: { doctorProfile: true },
  });

  return doctor;
}

export async function listDoctors() {
  return prisma.user.findMany({
    where: { role: "DOCTOR" },
    include: { doctorProfile: { include: { workingHours: true } } },
  });
}

export async function getDoctorById(userId: string) {
  const doctor = await prisma.user.findUnique({
    where: { id: userId, role: "DOCTOR" },
    include: {
      doctorProfile: {
        include: { workingHours: true, leaves: true },
      },
    },
  });

  if (!doctor || !doctor.doctorProfile) {
    throw new AppError("Doctor not found", 404);
  }

  return doctor;
}

export async function updateDoctorProfile(
  userId: string,
  data: { specialization?: string; bio?: string; slotDurationMinutes?: number }
) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError("Doctor not found", 404);
  }

  return prisma.doctorProfile.update({
    where: { userId },
    data,
  });
}

type WorkingHourInput = { dayOfWeek: number; startTime: string; endTime: string };

export async function setWorkingHours(userId: string, hours: WorkingHourInput[]) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError("Doctor not found", 404);
  }

  return prisma.$transaction(async (tx) => {
    await tx.doctorWorkingHour.deleteMany({ where: { doctorProfileId: profile.id } });
    await tx.doctorWorkingHour.createMany({
      data: hours.map((h) => ({ ...h, doctorProfileId: profile.id })),
    });
    return tx.doctorWorkingHour.findMany({ where: { doctorProfileId: profile.id } });
  });
}

export async function markLeave(userId: string, date: Date, reason?: string) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError("Doctor not found", 404);
  }

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const result = await prisma.$transaction(async (tx) => {
    const leave = await tx.doctorLeave.create({
      data: { doctorProfileId: profile.id, date: dayStart, reason },
    });

    const affectedAppointments = await tx.appointment.findMany({
      where: {
        doctorProfileId: profile.id,
        status: AppointmentStatus.BOOKED,
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      include: { patient: true },
    });

    const notifLogIds: string[] = [];

    for (const appt of affectedAppointments) {
      await tx.appointment.update({
        where: { id: appt.id },
        data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date() },
      });

      await tx.appointmentSlotLock.deleteMany({ where: { appointmentId: appt.id } });

      const notifLog = await tx.notificationLog.create({
        data: {
          type: NotificationType.LEAVE_NOTICE,
          recipientEmail: appt.patient.email,
          appointmentId: appt.id,
        },
      });
      notifLogIds.push(notifLog.id);
    }

    return { leave, affectedCount: affectedAppointments.length, notifLogIds };
  });

  for (const id of result.notifLogIds) {
    await enqueueNotification(id);
  }

  return { leave: result.leave, affectedCount: result.affectedCount };
}

export async function listLeaves(userId: string) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError("Doctor not found", 404);
  }

  return prisma.doctorLeave.findMany({
    where: { doctorProfileId: profile.id },
    orderBy: { date: "asc" },
  });
}
