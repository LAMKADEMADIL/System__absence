import { Timestamp } from 'firebase/firestore';

export type Absence = {
  month: number;
  day: number;
  session: number;
  profId: number;
  justification?: string;
};
export type Intern = {
  id: number;
  absence: Absence[];
  name: { first: string; last: string };
};
export type Group = {
  id: string;
  year: number;
  academicYear: number;
  interns: Intern[];
  name: string;
};
export type User = {
  id: number;
  name: { first: string; last: string };
  role: 'admin' | 'manager' | 'prof';
};

export type Signature = {
  profName: string;
  day: number;
  month: number;
  year: number;
  group: string;
  session: number;
  timeStamp: Timestamp;
};
