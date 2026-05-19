// Map raw org_members.role values to the three user-facing tiers.
// DB values: 'owner' | 'admin' | 'dispatcher' | 'crew'
// UI tiers:  Foreman    | Foreman | Supervisor   | Crew

export const isForeman    = role => role === 'owner' || role === 'admin';
export const isSupervisor = role => role === 'dispatcher';
export const isCrew       = role => role === 'crew';
export const isOffice     = role => isForeman(role) || isSupervisor(role);

export const roleLabel = role => {
  if (isForeman(role))    return 'Foreman';
  if (isSupervisor(role)) return 'Supervisor';
  if (isCrew(role))       return 'Crew';
  return 'Member';
};

export const tier = role => {
  if (isForeman(role))    return 'foreman';
  if (isSupervisor(role)) return 'supervisor';
  return 'crew';
};

// Display color per tier (used in chips, badges, etc.)
export const roleColor = role => {
  if (isForeman(role))    return '#4f9eff';
  if (isSupervisor(role)) return '#b197fc';
  return '#54d4f8';
};
