import { useMutation } from "@tanstack/react-query";
import { aiApi } from "../services/api";

export function useAnalyzeWebsite() {
  return useMutation({
    mutationFn: ({ url, pages }: { url: string; pages?: string[] }) =>
      aiApi.analyzeWebsite(url, pages),
  });
}

export function useGenerateCaption() {
  return useMutation({
    mutationFn: (data: {
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
    }) => aiApi.generateCaption(data),
  });
}

export function useSuggestHashtags() {
  return useMutation({
    mutationFn: (data: {
      caption: string;
      industry?: string;
      platform?: string;
    }) => aiApi.suggestHashtags(data),
  });
}

export function useCalculateViralityScore() {
  return useMutation({
    mutationFn: (data: {
      caption: string;
      hashtags?: string[];
      mediaType?: string;
      platform?: string;
      businessContext?: { industry?: string };
    }) => aiApi.calculateViralityScore(data),
  });
}

export function useSuggestGraphicsEmoji() {
  return useMutation({
    mutationFn: (data: {
      caption: string;
      hashtags?: string[];
      platform: string;
      industry?: string;
      postType?: string;
    }) => aiApi.suggestGraphicsEmoji(data),
  });
}
