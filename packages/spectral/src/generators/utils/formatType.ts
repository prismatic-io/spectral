export const formatType = (key: string) => (key?.match(/[^a-zA-Z0-9]/) ? `"${key}"` : key);
