export const truncatePathByFolder = (path: string, folder: string) =>
  path.split(folder)[1];
