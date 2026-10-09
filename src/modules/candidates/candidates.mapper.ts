import type { Candidate } from './entities/candidate.entity';

// Explicit allow-list rather than the entity, so a new column doesn't leak the day it's added.
export interface CandidateDto {
  id: string;
  certificateId: string;
  certificateNo: string;
  passportName: string;
  passportNo: string;
  dateOfBirth: string;
  address: string;
  email: string;
  course: { id: string; title: string };
  issueDate: string;
  nationality: string;
  isVerified: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toCandidateDto = (c: Candidate): CandidateDto => ({
  id: c.id,
  certificateId: c.certificateId,
  certificateNo: c.certificateNo,
  passportName: c.passportName,
  passportNo: c.passportNo,
  dateOfBirth: c.dateOfBirth,
  address: c.address,
  email: c.email,
  course: { id: c.course.id, title: c.course.title },
  issueDate: c.issueDate,
  nationality: c.nationality,
  isVerified: c.isVerified,
  verifiedAt: c.verifiedAt,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
