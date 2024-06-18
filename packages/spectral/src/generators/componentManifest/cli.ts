import { createComponentManifest } from "./index";
import { COMPONENT_DIR, COMPONENT_DIST_DIR, FLAGS } from "./constants";
import { createFlagHelpText } from "../utils/createFlagHelpText";

if (!COMPONENT_DIR) {
  console.error("Please run this script using npm or yarn.");
  process.exit(1);
}

if (FLAGS.HELP.value) {
  createFlagHelpText({
    command: "component-manifest",
    flags: FLAGS,
  });
  process.exit(0);
}

(async () => {
  await createComponentManifest({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires
    component: require(COMPONENT_DIST_DIR).default,
    dryRun: FLAGS.DRY_RUN.value,
    includeSignature: FLAGS.INCLUDE_SIGNATURE.value,
    name: FLAGS.NAME.value,
  });
})().catch((error) => {
  console.error(error);
});
