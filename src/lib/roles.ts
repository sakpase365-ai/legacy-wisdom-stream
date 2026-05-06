export const PRIMARY_OWNER_ROLES = [
  { value: 'parent',   label: 'Parent'   },
  { value: 'mother',   label: 'Mother'   },
  { value: 'father',   label: 'Father'   },
  { value: 'child',    label: 'Child'    },
  { value: 'son',      label: 'Son'      },
  { value: 'daughter', label: 'Daughter' },
  { value: 'sibling',  label: 'Sibling'  },
  { value: 'brother',  label: 'Brother'  },
  { value: 'sister',   label: 'Sister'   },
  { value: 'wife',     label: 'Wife'     },
  { value: 'husband',  label: 'Husband'  },
] as const;

export const SECONDARY_OWNER_ROLES = [
  { value: 'grandparent',  label: 'Grandparent'  },
  { value: 'grandmother',  label: 'Grandmother'  },
  { value: 'grandfather',  label: 'Grandfather'  },
] as const;

// For member rows: child/son/daughter shown first since that is the primary use case
export const PRIMARY_MEMBER_ROLES = [
  { value: 'child',    label: 'Child'    },
  { value: 'son',      label: 'Son'      },
  { value: 'daughter', label: 'Daughter' },
  { value: 'sibling',  label: 'Sibling'  },
  { value: 'brother',  label: 'Brother'  },
  { value: 'sister',   label: 'Sister'   },
  { value: 'mother',   label: 'Mother'   },
  { value: 'father',   label: 'Father'   },
  { value: 'parent',   label: 'Parent'   },
  { value: 'wife',     label: 'Wife'     },
  { value: 'husband',  label: 'Husband'  },
] as const;

export const SECONDARY_MEMBER_ROLES = [
  { value: 'grandparent',  label: 'Grandparent'  },
  { value: 'grandmother',  label: 'Grandmother'  },
  { value: 'grandfather',  label: 'Grandfather'  },
] as const;

export const SECONDARY_OWNER_VALUES: Set<string> = new Set(
  SECONDARY_OWNER_ROLES.map((r) => r.value)
);

// Roles that identify a younger generation (used to pick the default prompt recipient)
export const DESCENDENT_ROLES: Set<string> = new Set([
  'child', 'son', 'daughter',
]);

// All valid family identity roles including invite-only roles
export const INVITE_IDENTITY_ROLES = [
  { value: 'mother',      label: 'Mother'      },
  { value: 'father',      label: 'Father'      },
  { value: 'spouse',      label: 'Spouse'      },
  { value: 'co_parent',   label: 'Co-parent'   },
  { value: 'wife',        label: 'Wife'        },
  { value: 'husband',     label: 'Husband'     },
  { value: 'child',       label: 'Child'       },
  { value: 'son',         label: 'Son'         },
  { value: 'daughter',    label: 'Daughter'    },
  { value: 'sibling',     label: 'Sibling'     },
  { value: 'brother',     label: 'Brother'     },
  { value: 'sister',      label: 'Sister'      },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandmother', label: 'Grandmother' },
  { value: 'grandfather', label: 'Grandfather' },
  { value: 'parent',      label: 'Parent'      },
] as const;

export type FamilyIdentityRole = typeof INVITE_IDENTITY_ROLES[number]['value'];

// App permission roles — what a family member can do in the app
export const APP_PERMISSION_ROLES = [
  {
    value:       'admin',
    label:       'Admin',
    description: 'Can invite members and write breadcrumbs',
  },
  {
    value:       'contributor',
    label:       'Contributor',
    description: 'Can write breadcrumbs',
  },
  {
    value:       'recipient',
    label:       'Recipient',
    description: 'Receives breadcrumbs',
  },
] as const;

export type AppPermissionRole = 'owner' | 'admin' | 'contributor' | 'recipient';

export const VALID_IDENTITY_ROLE_VALUES: Set<string> = new Set(
  INVITE_IDENTITY_ROLES.map((r) => r.value)
);

export const VALID_PERMISSION_ROLE_VALUES: Set<string> = new Set([
  'owner', 'admin', 'contributor', 'recipient',
]);
