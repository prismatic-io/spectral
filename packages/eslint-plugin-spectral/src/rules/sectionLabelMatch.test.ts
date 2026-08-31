import { ruleTester } from "./ruleTester";
import rule from "./sectionLabelMatch";

ruleTester.run("section-label-match", rule, {
  valid: [
    `logger.section("one"); logger.sectionEnd({ label: "one" });`,
    `const label = "one"; logger.section(label); logger.sectionEnd({ label });`,
    // Two consts holding the same string still match.
    `const start = "one";
     const end = "one";
     logger.section(start);
     logger.sectionEnd({ label: end });`,
    // The same binding matches even when its value is unknowable at lint time.
    `const label = buildLabel();
     logger.section(label);
     logger.sectionEnd({ label });`,
    `logger.section(\`one\`); logger.sectionEnd({ label: "one" });`,
    // Distinct unresolvable labels could hold the same value at runtime.
    `logger.section(record.id); logger.sectionEnd({ label: other.id });`,
    // A reassignable binding is never read as a value.
    `let label = "one";
     label = "two";
     logger.section(label);
     logger.sectionEnd({ label: "two" });`,
    // Nothing to compare against.
    `logger.section("one"); logger.sectionEnd();`,
    `logger.section("one"); logger.sectionEnd({ data: {} });`,
  ],
  invalid: [
    {
      code: `logger.section("one"); logger.sectionEnd({ label: "two" });`,
      errors: [{ messageId: "mismatch", data: { startLabel: "one", endLabel: "two" } }],
    },
    {
      // A type annotation must not stop the label from resolving.
      code: `const start: string = "one";
             logger.section(start);
             logger.sectionEnd({ label: "two" });`,
      errors: [{ messageId: "mismatch", data: { startLabel: "one", endLabel: "two" } }],
    },
    {
      code: `const start = "one";
             const end = "two";
             logger.section(start);
             logger.sectionEnd({ label: end });`,
      errors: [{ messageId: "mismatch", data: { startLabel: "one", endLabel: "two" } }],
    },
    {
      // A mismatch is reported once and treated as closing the section, so the next
      // section is not also reported as nested.
      code: `logger.section("one");
             logger.sectionEnd({ label: "two" });
             logger.section("three");
             logger.sectionEnd({ label: "three" });`,
      errors: [{ messageId: "mismatch" }],
    },
  ],
});
