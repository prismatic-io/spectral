import { createComponentManifest } from "./index";
import {
  COMPONENT_DIR,
  COMPONENT_DIST_DIR,
  FLAG_DRY_RUN,
  FLAG_HELP,
  FLAG_HELP_TEXT,
  FLAG_INCLUDE_SIGNATURE,
} from "./constants";
import { createHelpFlagText } from "../utils/createHelpFlagText";

if (!COMPONENT_DIR) {
  console.error("Please run this script using npm or yarn.");
  process.exit(1);
}

if (FLAG_HELP) {
  createHelpFlagText({
    command: "component-manifest",
    flags: FLAG_HELP_TEXT,
  });
  process.exit(0);
}

(async () => {
  await createComponentManifest({
    dryRun: FLAG_DRY_RUN,
    includeSignature: FLAG_INCLUDE_SIGNATURE,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires
    component: require(COMPONENT_DIST_DIR).default,
  });
})().catch((error) => {
  console.error(error);
});
