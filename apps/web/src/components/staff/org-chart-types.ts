export type OrgChartPerson = {
  userId: string;
  email: string;
  name: string;
  photoUrl: string | null;
  staffNumber: string | null;
  staffProfileId: string | null;
  isActing?: boolean;
};

export type OrgChartPosition = {
  id: string;
  title: string;
  code: string;
  holders: OrgChartPerson[];
};

export type OrgChartStaff = {
  id: string;
  staffNumber: string;
  name: string;
  email: string;
  photoUrl: string | null;
  position: { id: string; title: string; code: string };
};

export type OrgChartNode = {
  id: string;
  name: string;
  code: string;
  type?: string;
  staff?: OrgChartStaff[];
  positions?: OrgChartPosition[];
  children?: OrgChartNode[];
};
