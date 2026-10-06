export interface PlatformApiConfig {
  baseUrl: string;
  jobId: string | null;
}

export interface RegistryArtifact {
  id: string;
  type: string;
  path: string;
  relativePath: string;
  fileName: string;
  detected_by: string;
  sha256?: string;
}
