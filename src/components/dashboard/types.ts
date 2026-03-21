export interface Project {
  id: string;
  title: string;
  template_id: string;
  vehicle_data: Record<string, unknown>;
  main_image_base64: string | null;
  main_image_url: string | null;
  html_content: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectImage {
  id: string;
  project_id: string;
  image_base64: string;
  image_url: string | null;
  perspective: string | null;
  gallery_folder: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  project_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  vehicle_title: string | null;
  created_at: string;
}

export interface VideoFile {
  name: string;
  url: string;
  created_at: string;
}

export interface BannerFile {
  name: string;
  url: string;
  created_at: string;
  fullPath: string;
}

export interface Spin360Job {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  manifest: { frameCount?: number } | null;
  displayStatus: string;
  displayError: string | null;
}

export function getVehicleField(vd: Record<string, unknown>, ...path: string[]): string {
  let current: unknown = vd;
  for (const key of path) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return '';
    }
  }
  return typeof current === 'string' ? current : '';
}

export function getImageSrc(img: ProjectImage): string {
  if (img.image_url) return img.image_url;
  return img.image_base64.startsWith('data:') ? img.image_base64 : `data:image/png;base64,${img.image_base64}`;
}
