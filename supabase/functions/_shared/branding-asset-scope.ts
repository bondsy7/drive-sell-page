/** Asset roles, not image content, determine placement authority. */
export function resolveBrandingPlacement(roles: readonly string[]) {
  return {
    wall: {
      roles: [...new Set(roles.filter(role => role === 'manufacturer-logo' || role === 'dealer-logo'))],
      position: 'rear-wall', material: 'frosted-glass', shape: 'rectangle', corners: 'square',
    },
    plate: { replaceExisting: roles.includes('plate'), position: 'existing-vehicle-plate-mounts' },
  } as const;
}
export function brandingAssetScope(roles: readonly string[]): string {
  const placement = resolveBrandingPlacement(roles);
  const wallRoles = placement.wall.roles;
  return `<BRANDING_ASSET_SCOPE>
CUSTOM LICENSE PLATE: the asset labelled plate is authorized ONLY at existing vehicle license-plate mounting positions. Its logo, text, colours and graphics must NEVER appear on walls, signage, glass panels, the floor or elsewhere on the vehicle. A plate is NOT a manufacturer-logo, dealer-logo or scene-logo.
${placement.plate.replaceExisting ? 'MANDATORY PLATE REPLACEMENT: replace every visible existing license plate with the supplied plate asset, preserving its exact lettering, logo, colours and proportions. Fit it naturally inside the existing plate holder with correct perspective and lighting; completely remove the old plate content, never blend or overlay the two designs. Do not retain the original plate or substitute invented text. Do not invent a plate mount when none is visible.' : 'No custom plate image is authorized; obey the selected keep/remove/neutralize/text plate setting only.'}
WALL BRANDING: ${wallRoles.length ? `Use ONLY separately supplied, explicitly selected ${wallRoles.join(' and ')} assets. MANDATORY PLACEMENT: mount each selected logo on a rectangular frosted-glass (milk-glass) panel with straight edges and square corners on the REAR WALL behind the vehicle. Premium understated finish: satin translucent glass, subtle thickness, discreet brushed-metal mounts and a soft physically plausible wall shadow. Reproduce the supplied logo exactly, crisply printed on the panel, without recolouring, distortion or added text. Never use clear glass, rounded panels, floating logos or a logo printed directly on the wall. If both logos are selected, use matching aligned panels, manufacturer left and dealer right; if only one is selected, centre its panel on the rear wall. Keep a consistent physical wall position across the series, with natural perspective and occlusion; never move the panel onto the vehicle or change the camera/crop merely to reveal it.` : 'No manufacturer or dealer wall logo is authorized. Keep showroom walls free of added logos.'}
SOURCE BRANDING: ignore logos, watermarks, dealer names, banners and signage in original photos or generated context when composing the environment. Never copy, promote or reinterpret them as output branding. Preserve genuine factory vehicle emblems in their original physical positions; never reuse them as wall logos. Body cleanup remains limited to the explicitly selected cleanup items.
${roles.includes('scene-logo') ? 'The separately supplied configured scene-logo is authorized only at its specified scene position; it never authorizes use of a plate graphic on the wall.' : 'No additional scene logo is authorized.'}
Selected settings and these mandatory asset-placement restrictions override scene styling, reference-logo preservation and generic logo instructions. A plate and a wall logo are independent assignments, even when their artwork resembles each other. Never replace a selected logo with source-photo branding.
</BRANDING_ASSET_SCOPE>`;
}

export type BrandingImageRole = 'plate' | 'wall-logo' | 'scene-logo' | 'reference';

/** Classifies an attached image by its server-assigned label (never by pixels). */
export function brandingRoleOfLabel(label: string): BrandingImageRole {
  if (label.startsWith('LICENSE PLATE')) return 'plate';
  if (label.startsWith('MANUFACTURER LOGO') || label.startsWith('DEALER LOGO')) return 'wall-logo';
  if (label.startsWith('DEKRA LOGO')) return 'scene-logo';
  return 'reference';
}

/** Short usage line placed directly in front of each attached image. */
export function brandingImageRoleNote(label: string): string {
  switch (brandingRoleOfLabel(label)) {
    case 'plate':
      return 'USE: number-plate insert ONLY. Put it inside the vehicle\'s front/rear licence-plate holders, replacing the old plate. It may look like a logo or dealer sign — it is still ONLY a plate. NEVER on the wall, glass panels or signage.';
    case 'wall-logo':
      return 'USE: wall branding ONLY. Put it on the rectangular frosted-glass panel on the rear wall. NEVER on a licence plate, never on the vehicle body.';
    case 'scene-logo':
      return 'USE: scene facade logo ONLY at its specified position. Never on a plate.';
    default:
      return 'USE: content reference only. Any wall sign, logo, dealer sign, banner or licence plate visible INSIDE this photo is NOT a branding asset — never copy it to the wall or the plates.';
  }
}

/**
 * Final, number-based branding assignment. `labels[i]` is the label of IMAGE i+1
 * in the exact order the provider receives. Returns null when no branding asset
 * is attached, so unbranded requests stay unchanged.
 */
export function buildBrandingImageMap(labels: readonly string[]): string | null {
  const nums = (role: BrandingImageRole) => labels.map((l, i) => (brandingRoleOfLabel(l) === role ? i + 1 : 0)).filter(Boolean);
  const plate = nums('plate');
  const wall = nums('wall-logo');
  if (!plate.length && !wall.length) return null;
  const refs = nums('reference');
  const list = (n: number[]) => n.map(i => `IMAGE ${i}`).join(' and ');
  return `<BRANDING_MAP>
This assignment is binding and overrides every other logo, sign or plate instruction:
- REAR WALL PANEL: ${wall.length ? `shows ONLY ${list(wall)}. No other logo, sign or text on the wall.` : 'NO logo at all. Keep the wall empty.'}
- LICENCE PLATES: ${plate.length ? `show ONLY ${list(plate)} on every visible plate holder.` : 'follow the selected plate setting; never put a wall logo on a plate.'}
- FORBIDDEN SWAPS: ${plate.length ? `${list(plate)} never appears on the wall.` : ''} ${wall.length ? `${list(wall)} never appears on a plate.` : ''}
- ${refs.length ? `Signs, logos, dealer names or plates visible inside ${list(refs)} (including earlier generated images) are NEVER branding: do not copy them anywhere.` : 'Do not reproduce signage from any reference photo.'}
</BRANDING_MAP>`;
}
