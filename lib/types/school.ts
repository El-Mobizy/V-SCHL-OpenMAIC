// lib/types/school.ts

/** User from Symfony JWT payload */
export interface SchoolUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'student';
  department: string;
  program: string;
  level: string;
}

/** JWT tokens from Symfony login response */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: SchoolUser;
}

/** Course from Symfony */
export interface Course {
  id: number;
  title: string;
  description: string;
  objectives: string[];
  department: string;
  program: string;
  level: string;
  thumbnail_url?: string;
}

/** Student progress for a course */
export interface CourseProgress {
  course_id: number;
  student_id: number;
  current_scene_index: number;
  completed_scenes: number[];
  last_accessed: string; // ISO date
  total_scenes: number;
}

/** Token quota from Symfony */
export interface TokenQuota {
  max_tokens: number;
  used_tokens: number;
  reset_date: string; // ISO date
}

/** School branding from Symfony */
export interface SchoolBranding {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  school_name: string;
  favicon_url?: string;
}

/** Available provider for students (no API key exposed) */
export interface AvailableProvider {
  id: string;
  name: string;
  models: Array<{ id: string; name: string }>;
}
