import { Imports } from "../componentManifest/getImports";

export interface CreateDependencyImportsProps {
  imports: Imports;
}

export const createDependencyImports = ({
  imports,
}: CreateDependencyImportsProps) => {
  return Object.entries(imports).map(([module, types]) => {
    return `import type { ${types.join(", ")} } from "${module}";`;
  });
};
