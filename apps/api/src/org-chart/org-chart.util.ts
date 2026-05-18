type UserProfileJson = Record<string, unknown> | null;

export type OrgChartPerson = {
  userId: string;
  email: string;
  name: string;
  photoUrl: string | null;
  staffNumber: string | null;
  staffProfileId: string | null;
  isActing?: boolean;
};

export type OrgChartPositionNode = {
  id: string;
  title: string;
  code: string;
  holders: OrgChartPerson[];
};

export type OrgChartStaffNode = {
  id: string;
  staffNumber: string;
  name: string;
  email: string;
  photoUrl: string | null;
  position: { id: string; title: string; code: string };
};

export type OrgChartTreeNode = {
  id: string;
  name: string;
  code: string;
  type: string;
  staff: OrgChartStaffNode[];
  positions: OrgChartPositionNode[];
  children: OrgChartTreeNode[];
};

export function displayNameFromProfile(
  profile: UserProfileJson,
  email: string,
): { name: string; photoUrl: string | null } {
  const joined = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const name = (profile?.displayName as string) ?? (profile?.name as string) ?? (joined || email);
  const photoUrl =
    (profile?.avatarUrl as string) ??
    (profile?.photoUrl as string) ??
    (profile?.image as string) ??
    null;
  return { name, photoUrl };
}

function profileHasName(profile: UserProfileJson): boolean {
  if (!profile) return false;
  return Boolean(profile.displayName || profile.name || profile.firstName || profile.lastName);
}

export function mapHolderPerson(holder: {
  userId: string;
  isActing: boolean;
  user: {
    email: string;
    profile: UserProfileJson;
    staffProfile: {
      id: string;
      staffNumber: string;
      user: { profile: UserProfileJson };
    } | null;
  };
}): OrgChartPerson {
  const staff = holder.user.staffProfile;
  const holderProfile = holder.user.profile as UserProfileJson;
  const staffUserProfile = (staff?.user.profile ?? null) as UserProfileJson;
  const nameProfile = profileHasName(staffUserProfile) ? staffUserProfile : holderProfile;
  const { name } = displayNameFromProfile(nameProfile, holder.user.email);
  const staffPhoto = displayNameFromProfile(staffUserProfile, holder.user.email).photoUrl;
  const userPhoto = displayNameFromProfile(holderProfile, holder.user.email).photoUrl;
  const photoUrl = staffPhoto ?? userPhoto;
  return {
    userId: holder.userId,
    email: holder.user.email,
    name,
    photoUrl,
    staffNumber: staff?.staffNumber ?? null,
    staffProfileId: staff?.id ?? null,
    isActing: holder.isActing,
  };
}

export function mapStaffOnUnit(profile: {
  id: string;
  staffNumber: string;
  user: { email: string; profile: UserProfileJson };
  position: { id: string; title: string; code: string };
}): OrgChartStaffNode {
  const { name, photoUrl } = displayNameFromProfile(profile.user.profile, profile.user.email);
  return {
    id: profile.id,
    staffNumber: profile.staffNumber,
    name,
    email: profile.user.email,
    photoUrl,
    position: profile.position,
  };
}

type OrgUnitRow = {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  positions: Array<{
    id: string;
    title: string;
    code: string;
    holders: Parameters<typeof mapHolderPerson>[0][];
  }>;
  staffProfiles: Parameters<typeof mapStaffOnUnit>[0][];
};

export function buildOrgChartTree(units: OrgUnitRow[]): OrgChartTreeNode[] {
  const byParent = new Map<string | null, OrgUnitRow[]>();
  for (const u of units) {
    const key = u.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(u);
    byParent.set(key, list);
  }

  const build = (parentId: string | null): OrgChartTreeNode[] =>
    (byParent.get(parentId) ?? []).map((unit) => ({
      id: unit.id,
      name: unit.name,
      code: unit.code,
      type: unit.type,
      staff: unit.staffProfiles.map(mapStaffOnUnit),
      positions: unit.positions.map((p) => ({
        id: p.id,
        title: p.title,
        code: p.code,
        holders: p.holders.map(mapHolderPerson),
      })),
      children: build(unit.id),
    }));

  return build(null);
}
