import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as adminService from "./admin.service";

const createDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  specialization: z.string().min(1),
  bio: z.string().optional(),
  slotDurationMinutes: z.number().int().positive().optional(),
});

const updateDoctorSchema = z.object({
  specialization: z.string().min(1).optional(),
  bio: z.string().optional(),
  slotDurationMinutes: z.number().int().positive().optional(),
});

const workingHoursSchema = z.array(
  z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
);

const leaveSchema = z.object({
  date: z.string().datetime().or(z.string()),
  reason: z.string().optional(),
});

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createDoctorSchema.parse(req.body);
    const doctor = await adminService.createDoctor(data);
    res.status(201).json(doctor);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const doctors = await adminService.listDoctors();
    res.status(200).json(doctors);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const doctor = await adminService.getDoctorById(req.params.id);
    res.status(200).json(doctor);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateDoctorSchema.parse(req.body);
    const profile = await adminService.updateDoctorProfile(req.params.id, data);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function setHours(req: Request, res: Response, next: NextFunction) {
  try {
    const hours = workingHoursSchema.parse(req.body);
    const result = await adminService.setWorkingHours(req.params.id, hours);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, reason } = leaveSchema.parse(req.body);
    const result = await adminService.markLeave(req.params.id, new Date(date), reason);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLeaves(req: Request, res: Response, next: NextFunction) {
  try {
    const leaves = await adminService.listLeaves(req.params.id);
    res.status(200).json(leaves);
  } catch (err) {
    next(err);
  }
}
