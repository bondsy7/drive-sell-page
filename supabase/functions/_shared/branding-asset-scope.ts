/** Asset roles, not image content, determine placement authority. */
export function brandingAssetScope(roles: readonly string[]): string {
  const wallRoles = roles.filter(role => role === 'manufacturer-logo' || role === 'dealer-logo');
  return `<BRANDING_ASSET_SCOPE>
CUSTOM LICENSE PLATE: the asset labelled plate is authorized ONLY at existing vehicle license-plate mounting positions. Its logo, text, colours and graphics must NEVER appear on walls, signage, glass panels, the floor or elsewhere on the vehicle. A plate is NOT a manufacturer-logo, dealer-logo or scene-logo.
WALL BRANDING: ${wallRoles.length ? `Use ONLY separately supplied, explicitly selected ${wallRoles.join(' and ')} assets at their assigned wall positions.` : 'No manufacturer or dealer wall logo is authorized. Keep showroom walls free of added logos.'}
SOURCE BRANDING: ignore logos, watermarks, dealer names, banners and signage in original photos or generated context when composing the environment. Never copy, promote or reinterpret them as output branding. Preserve genuine factory vehicle emblems in their original physical positions; never reuse them as wall logos. Body cleanup remains limited to the explicitly selected cleanup items.
${roles.includes('scene-logo') ? 'The separately supplied configured scene-logo is authorized only at its specified scene position; it never authorizes use of a plate graphic on the wall.' : 'No additional scene logo is authorized.'}
These asset-placement restrictions override scene styling, reference-logo preservation and generic logo instructions.
</BRANDING_ASSET_SCOPE>`;
}
