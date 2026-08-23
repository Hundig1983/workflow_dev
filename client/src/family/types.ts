export interface FamilyMember {
  userId: string;
  email: string;
  role: string;
}

export interface DashboardSection {
  key: string;
  items: unknown[];
}

export interface Dashboard {
  family: { id: string; name: string };
  members: FamilyMember[];
  sections: DashboardSection[];
  /** The API's explicit "this family has no content yet" signal (family-dashboard spec). */
  isEmpty: boolean;
}
