import rule from "./noUnclosedSection";
import { ruleTester } from "./ruleTester";

ruleTester.run("no-unclosed-section", rule, {
  valid: [
    `logger.section("one"); logger.sectionEnd({ label: "one" });`,
    // A const label resolves to the same string on both sides.
    `const label = "one";
     logger.section(label);
     logger.sectionEnd({ label });`,
    // An early return between the pair is auto-closed by the runtime.
    `const onExecution = async (context) => {
       const { logger } = context;
       logger.section("one");
       if (!context.params) return;
       logger.sectionEnd({ label: "one" });
     };`,
    `for (const record of records) {
       logger.section(record.id);
       logger.sectionEnd({ label: record.id });
     }`,
    `logger.info("no sections here");`,
  ],
  invalid: [
    {
      code: `logger.section("one"); doWork();`,
      errors: [{ messageId: "unclosed", data: { label: "one" } }],
    },
    {
      code: `logger.section(buildLabel()); doWork();`,
      errors: [{ messageId: "unclosedUnknownLabel" }],
    },
    {
      code: `logger.sectionEnd({ label: "one" });`,
      errors: [{ messageId: "strayEnd" }],
    },
    {
      // Each function body is analyzed on its own, so closing from inside a callback
      // is out of reach and reported as unclosed.
      code: `const run = async () => {
               logger.section("one");
               await items.map(async () => {
                 logger.sectionEnd({ label: "one" });
               });
             };`,
      errors: [{ messageId: "unclosed", data: { label: "one" } }, { messageId: "strayEnd" }],
    },
    {
      code: `const run = async () => {
               logger.section("one");
             };
             const other = async () => {
               logger.section("two");
             };`,
      errors: [
        { messageId: "unclosed", data: { label: "one" } },
        { messageId: "unclosed", data: { label: "two" } },
      ],
    },
  ],
});
