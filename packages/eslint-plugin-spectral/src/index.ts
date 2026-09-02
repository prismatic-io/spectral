import noNestedSection from "./rules/noNestedSection";
import noSectionOutsideFlow from "./rules/noSectionOutsideFlow";
import noUnclosedSection from "./rules/noUnclosedSection";
import sectionInLoop from "./rules/sectionInLoop";
import sectionLabelMatch from "./rules/sectionLabelMatch";

const plugin = {
  rules: {
    "no-nested-section": noNestedSection,
    "no-section-outside-flow": noSectionOutsideFlow,
    "no-unclosed-section": noUnclosedSection,
    "section-in-loop": sectionInLoop,
    "section-label-match": sectionLabelMatch,
  },
  configs: {
    recommended: {
      plugins: ["@prismatic-io/spectral"],
      rules: {
        "@prismatic-io/spectral/no-nested-section": "error",
        "@prismatic-io/spectral/no-section-outside-flow": "error",
        "@prismatic-io/spectral/no-unclosed-section": "error",
        "@prismatic-io/spectral/section-in-loop": "warn",
        "@prismatic-io/spectral/section-label-match": "error",
      },
    },
  },
};

export = plugin;
