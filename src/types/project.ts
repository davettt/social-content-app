export interface SocialHandles {
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  threads?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  socialHandles: SocialHandles;
}

export interface BrandKit {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fonts: {
    heading: string;
    body: string;
  };
  logoPath?: string;
  colorPalette?: string[]; // All colors extracted from website for user to pick from
}

export interface BusinessInfo {
  websiteUrl?: string;
  industry?: string;
  description: string;
  targetAudience?: string;
  services: string[];
  tone: "professional" | "casual" | "fun" | "inspirational" | "educational";
}

export interface ProjectSettings {
  defaultPlatforms: Platform[];
  watermarkEnabled: boolean;
}

export type Platform = "instagram" | "threads" | "twitter" | "linkedin";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  businessInfo: BusinessInfo;
  contactInfo: ContactInfo;
  brandKit: BrandKit;
  settings: ProjectSettings;
}

export type CreateProjectInput = Pick<Project, "name"> & {
  businessInfo?: Partial<BusinessInfo>;
  contactInfo?: Partial<ContactInfo>;
  brandKit?: Partial<BrandKit>;
};

export type UpdateProjectInput = {
  name?: string;
  updatedAt?: string;
  businessInfo?: Partial<BusinessInfo>;
  contactInfo?: Partial<ContactInfo>;
  brandKit?: Partial<BrandKit>;
  settings?: Partial<ProjectSettings>;
};
