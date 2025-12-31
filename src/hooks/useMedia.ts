import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi } from '../services/api';
import type { Media } from '../types';

export function useMedia(projectId: string | undefined, params?: { type?: string; search?: string }) {
  return useQuery({
    queryKey: ['media', projectId, params],
    queryFn: () => (projectId ? mediaApi.list(projectId, params) : []),
    enabled: !!projectId,
  });
}

export function useMediaItem(projectId: string | undefined, mediaId: string | undefined) {
  return useQuery({
    queryKey: ['media', projectId, mediaId],
    queryFn: () => (projectId && mediaId ? mediaApi.get(projectId, mediaId) : null),
    enabled: !!projectId && !!mediaId,
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, files }: { projectId: string; files: File[] }) =>
      mediaApi.upload(projectId, files),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['media', projectId] });
    },
  });
}

export function useUpdateMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      mediaId,
      data,
    }: {
      projectId: string;
      mediaId: string;
      data: { userMetadata: Partial<Media['userMetadata']> };
    }) => mediaApi.update(projectId, mediaId, data),
    onSuccess: (_, { projectId, mediaId }) => {
      queryClient.invalidateQueries({ queryKey: ['media', projectId] });
      queryClient.invalidateQueries({ queryKey: ['media', projectId, mediaId] });
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, mediaId }: { projectId: string; mediaId: string }) =>
      mediaApi.delete(projectId, mediaId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['media', projectId] });
    },
  });
}
