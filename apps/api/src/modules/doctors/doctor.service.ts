import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { generatePostVisitSummary } from "../../lib/llm";
import { medicationReminderQueue } from "../../jobs/medicationReminder.queue";

export async function searchDoctors(specialization?: string) {
  return prisma.user.findMany({
    where: {
      role: "DOCTOR",
      ...(specialization && {
        doctorProfile: { specialization: { contains: specialization, mode: "insensitive" } },
      }),
    },
    include: { doctorProfile: true },
  });
}

export async function getAvailableSlots(doctorUserId: string, dateStr: string) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: doctorUserId },
    include: { workingHours: true },
  });
  if (!profile) throw new AppError("Doctor not found", 404);

  const date = new Date(dateStr + "T00:00:00.000Z");
  const dayOfWeek = date.getUTCDay();

  const dayStart = new Date(date);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const onLeave = await prisma.doctorLeave.findFirst({
    where: { doctorProfileId: profile.id, date: { gte: dayStart, lte: dayEnd } },
  });
  if (onLeave) return [];

  const hours = profile.workingHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!hours) return [];

  const [startH, startM] = hours.startTime.split(":").map(Number);
  const [endH, endM] = hours.endTime.split(":").map(Number);

  const slotStart = new Date(date);
  slotStart.setUTCHours(startH, startM, 0, 0);
  const workEnd = new Date(date);
  workEnd.setUTCHours(endH, endM, 0, 0);

  const bookedLocks = await prisma.appointmentSlotLock.findMany({
    where: { doctorProfileId: profile.id, scheduledAt: { gte: dayStart, lte: dayEnd } },
    select: { scheduledAt: true },
  });
  const bookedTimes = new Set(bookedLocks.map((l) => l.scheduledAt.toISOString()));

  const slots: string[] = [];
  const cursor = new Date(slotStart);
  while (cursor < workEnd) {
    if (!bookedTimes.has(cursor.toISOString())) {
      slots.push(cursor.toISOString());
    }
    cursor.setMinutes(cursor.getMinutes() + profile.slotDurationMinutes);
  }

  return slots;
}

export async function getTodaysAppointments(doctorUserId: string) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
  if (!profile) throw new AppError("Doctor profile not found", 404);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return prisma.appointment.findMany({
    where: {
      doctorProfileId: profile.id,
      scheduledAt: { gte: todayStart, lte: todayEnd },
      status: "BOOKED",
    },
    include: { patient: { select: { name: true, email: true } } },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function submitVisitNotes(
  doctorUserId: string,
  appointmentId: string,
  doctorNotes: string,
  prescription?: string
) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
  if (!profile) throw new AppError("Doctor profile not found", 404);

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.doctorProfileId !== profile.id) {
    throw new AppError("Appointment not found", 404);
  }

  const postVisitSummary = await generatePostVisitSummary(
    `Doctor's notes: ${doctorNotes}. Prescription: ${prescription ?? "None"}`
  );

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { doctorNotes, prescription, postVisitSummary, status: "COMPLETED" },
  });

  if (prescription) {
    const reminder = await prisma.medicationReminder.create({
      data: {
        appointmentId,
        medicationName: prescription,
        frequencyPerDay: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    await medicationReminderQueue.add(
      "send-reminder",
      { reminderId: reminder.id },
      {
        repeat: { every: 24 * 60 * 60 * 1000 },
        jobId: `reminder-${reminder.id}`,
      }
    );
  }

  return updated;
}
