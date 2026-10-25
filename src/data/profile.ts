export interface UserProfile {
  fullName: string;
  assignedUnit: string;
}

export interface UploaderProfile extends UserProfile {
  email: string;
  role: string;
}
