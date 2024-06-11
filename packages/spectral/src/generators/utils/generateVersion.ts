export const generateVersion = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1);
  const day = String(now.getUTCDate());
  const hours = String(now.getUTCHours());
  const minutes = String(now.getUTCMinutes());
  const seconds = String(now.getUTCSeconds());

  return `${year}.${month}.${day}-t-${hours}.${minutes}.${seconds}`;
};
