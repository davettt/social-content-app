import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Media,
  MediaUploadResult,
  CaptionSuggestion,
  ViralityScore,
} from "../types";

const API_BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP error ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Projects API
export const projectsApi = {
  list: () => fetchJson<Project[]>(`${API_BASE}/projects`),

  get: (id: string) => fetchJson<Project>(`${API_BASE}/projects/${id}`),

  create: (data: CreateProjectInput) =>
    fetchJson<Project>(`${API_BASE}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateProjectInput) =>
    fetchJson<Project>(`${API_BASE}/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchJson<void>(`${API_BASE}/projects/${id}`, { method: "DELETE" }),
};

// Media API
export const mediaApi = {
  list: (projectId: string, params?: { type?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set("type", params.type);
    if (params?.search) searchParams.set("search", params.search);
    const query = searchParams.toString();
    return fetchJson<Media[]>(
      `${API_BASE}/media/${projectId}${query ? `?${query}` : ""}`,
    );
  },

  get: (projectId: string, mediaId: string) =>
    fetchJson<Media>(`${API_BASE}/media/${projectId}/${mediaId}`),

  upload: async (
    projectId: string,
    files: File[],
  ): Promise<MediaUploadResult[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await fetch(`${API_BASE}/media/${projectId}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    return response.json();
  },

  update: (
    projectId: string,
    mediaId: string,
    data: { userMetadata: Partial<Media["userMetadata"]> },
  ) =>
    fetchJson<Media>(`${API_BASE}/media/${projectId}/${mediaId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (projectId: string, mediaId: string) =>
    fetchJson<void>(`${API_BASE}/media/${projectId}/${mediaId}`, {
      method: "DELETE",
    }),
};

// AI API
export const aiApi = {
  analyzeWebsite: (url: string, pages?: string[]) =>
    fetchJson<{
      success: boolean;
      analysis?: {
        businessName: string;
        description: string;
        industry: string;
        services: string[];
        targetAudience: string;
        tone: string;
        suggestedColors: { primary: string; secondary: string; accent: string };
        extractedColorPalette?: string[];
        suggestedFonts?: { heading: string; body: string };
        contactInfo: { email?: string; phone?: string; address?: string };
        socialHandles: {
          instagram?: string;
          twitter?: string;
          linkedin?: string;
        };
      };
      error?: string;
    }>(`${API_BASE}/ai/analyze-website`, {
      method: "POST",
      body: JSON.stringify({ url, pages }),
    }),

  generateCaption: (data: {
    mediaDescription: string;
    businessContext?: {
      industry?: string;
      targetAudience?: string;
      tone?: string;
    } | null;
    platform?: string;
    draftCaption?: string;
    captionStyle?: string;
    postType?: string;
    location?: {
      placeName?: string | null;
      latitude?: number;
      longitude?: number;
    } | null;
  }) =>
    fetchJson<{ captions: CaptionSuggestion[] }>(
      `${API_BASE}/ai/generate-caption`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  suggestHashtags: (data: {
    caption: string;
    industry?: string;
    platform?: string;
  }) =>
    fetchJson<{
      hashtags: string[];
      categories: { popular: string[]; niche: string[]; branded?: string[] };
    }>(`${API_BASE}/ai/suggest-hashtags`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  calculateViralityScore: (data: {
    caption: string;
    hashtags?: string[];
    mediaType?: string;
    platform?: string;
    businessContext?: { industry?: string };
  }) =>
    fetchJson<ViralityScore>(`${API_BASE}/ai/virality-score`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Export API
export const exportApi = {
  prepare: (data: {
    projectId: string;
    postId?: string;
    platforms?: string[];
    platformAspects?: Record<string, { width: number; height: number }>;
    caption?: string;
    mediaIds?: string[];
    editedImages?: Record<string, string>;
    collages?: string[];
  }) =>
    fetchJson<{ id: string; status: string; platforms: string[] }>(
      `${API_BASE}/export/prepare`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  getDownloadUrl: (exportId: string) =>
    `${API_BASE}/export/${exportId}/download`,

  getStatus: (exportId: string) =>
    fetchJson<{
      id: string;
      status: string;
      platforms: string[];
      createdAt: string;
    }>(`${API_BASE}/export/${exportId}/status`),
};
