const ROLE_POLICIES = {
  admin: {
    allowMasking: true,
    allowHighSeverity: false,
    allowTrustedBypass: true,
    minTrustLevel: 'low'
  },
  user: {
    allowMasking: true,
    allowHighSeverity: false,
    allowTrustedBypass: false,
    minTrustLevel: 'medium'
  },
  guest: {
    allowMasking: false,
    allowHighSeverity: false,
    allowTrustedBypass: false,
    minTrustLevel: 'high'
  },
  anonymous: {
    allowMasking: false,
    allowHighSeverity: false,
    allowTrustedBypass: false,
    minTrustLevel: 'high'
  }
};

const TRUST_RANK = {
  low: 1,
  medium: 2,
  high: 3
};

function getRolePolicy(role) {
  return ROLE_POLICIES[role] || ROLE_POLICIES.anonymous;
}

function canBypassHighSeverity(context) {
  const policy = getRolePolicy(context.role);
  return policy.allowTrustedBypass && (TRUST_RANK[context.trustLevel] || 0) >= (TRUST_RANK[policy.minTrustLevel] || 0);
}

function canMask(context) {
  const policy = getRolePolicy(context.role);
  return Boolean(policy.allowMasking);
}

function allowsDecision(decision, context) {
  const policy = getRolePolicy(context.role);
  if (decision === 'MASK') return policy.allowMasking;
  if (decision === 'BLOCK') return !policy.allowHighSeverity;
  return true;
}

module.exports = { getRolePolicy, canBypassHighSeverity, canMask, allowsDecision, TRUST_RANK };
