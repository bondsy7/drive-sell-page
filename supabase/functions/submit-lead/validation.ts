import { z } from 'npm:zod@3.25.76';

const text = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), 'Unzulässige Zeichen.');
const optionalId = z.string().uuid().nullish();
export const leadSchema = z.object({
  dealerUserId: z.string().uuid(),
  projectId: optionalId,
  vehicleId: optionalId,
  name: text(200).refine(v => v.length > 0),
  email: z.string().trim().max(255).email().refine(v => !/[\r\n]/.test(v)),
  phone: text(50).refine(v => /^[+0-9() /.-]*$/.test(v)).nullish(),
  message: text(3200).nullish(),
  vehicleTitle: text(300).nullish(),
  website: z.string().max(1000).optional().default(''),
  interestedTestDrive: z.boolean().optional().default(false),
  interestedTradeIn: z.boolean().optional().default(false),
  interestedLeasing: z.boolean().optional().default(false),
  interestedFinancing: z.boolean().optional().default(false),
  interestedPurchase: z.boolean().optional().default(false),
});

export function isHoneypotSubmission(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'website' in value &&
    typeof value.website === 'string' && value.website.trim().length > 0;
}

export function ownsLeadContext(dealer: string, project: { user_id: string; vehicle_id: string | null } | null, vehicle: { user_id: string } | null, projectId?: string | null, vehicleId?: string | null): boolean {
  if (projectId && (!project || project.user_id !== dealer)) return false;
  if (vehicleId && (!vehicle || vehicle.user_id !== dealer)) return false;
  if (project?.vehicle_id && vehicleId && project.vehicle_id !== vehicleId) return false;
  return true;
}