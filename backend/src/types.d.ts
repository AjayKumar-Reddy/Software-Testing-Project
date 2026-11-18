import type { Role } from "./models/constants";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  facultyId: string | null; // Faculty document _id
  departmentId: string | null; // department of the linked faculty record
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
