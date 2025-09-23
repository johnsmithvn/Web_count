export const isLimitEnabled = (value, defaultValue = true) => {
  if (value === false || value === 'false') {
    return false;
  }
  if (value === true || value === 'true') {
    return true;
  }
  return defaultValue;
};

export const normalizeLimitValue = (value, fallback = 100) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
