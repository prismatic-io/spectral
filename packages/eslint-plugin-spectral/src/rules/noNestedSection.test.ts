import rule from "./noNestedSection";
import { ruleTester } from "./ruleTester";

ruleTester.run("no-nested-section", rule, {
  valid: [
    // Sequential sections in one function are fine; only overlap is nesting.
    `const { logger } = context;
     logger.section("one");
     logger.sectionEnd({ label: "one" });
     logger.section("two");
     logger.sectionEnd({ label: "two" });`,
    // A section per loop iteration opens and closes within the iteration.
    `for (const record of records) {
       logger.section(record.id);
       logger.sectionEnd({ label: record.id });
     }`,
    // Each callback is its own scope, so these are not statically nested.
    `items.forEach(() => {
       logger.section("a");
       logger.sectionEnd({ label: "a" });
     });
     other.forEach(() => {
       logger.section("b");
       logger.sectionEnd({ label: "b" });
     });`,
    // The receiver has to look like a logger.
    `queryBuilder.section("a"); queryBuilder.section("b");`,
    `context.logger.section("a"); context.logger.sectionEnd({ label: "a" });`,
  ],
  invalid: [
    {
      code: `logger.section("outer"); logger.section("inner");`,
      errors: [{ messageId: "nested", data: { openLabel: "outer" } }],
    },
    {
      // The rejected inner section must not consume the end that closes "outer",
      // so no-unclosed-section has nothing to add here.
      code: `logger.section("outer");
             logger.section("inner");
             logger.sectionEnd({ label: "outer" });`,
      errors: [{ messageId: "nested" }],
    },
    {
      code: `logger.section(buildLabel()); logger.section("inner");`,
      errors: [{ messageId: "nestedUnknownLabel" }],
    },
    {
      code: `const { logger } = context;
             logger.section("a");
             await doWork();
             logger.section("b");
             logger.sectionEnd({ label: "b" });`,
      errors: [{ messageId: "nested", data: { openLabel: "a" } }],
    },
  ],
});
