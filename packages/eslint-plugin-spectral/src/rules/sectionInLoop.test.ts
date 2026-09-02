import { ruleTester } from "./ruleTester";
import rule from "./sectionInLoop";

ruleTester.run("section-in-loop", rule, {
  valid: [
    // One section around the whole loop is the shape this rule is steering toward.
    `flow({
       onExecution: async ({ logger }) => {
         logger.section("sync customers");
         for (const record of records) {
           logger.info(record.id);
         }
         logger.sectionEnd({ label: "sync customers" });
       },
     });`,
    // A section that does not repeat.
    `flow({
       onExecution: async ({ logger }) => {
         logger.section("one");
         logger.sectionEnd({ label: "one" });
       },
     });`,
    // Closing a section inside a loop is how a per-batch section gets closed; only opens repeat.
    `for (const record of records) {
       logger.sectionEnd({ label: record.id });
     }`,
    // A `for` initializer runs once.
    `for (let index = logger.section("one"); index < 10; index += 1) {
       logger.info(index);
     }`,
    // Not an iteration method, just a method that takes a callback.
    `records.then(() => {
       logger.section("one");
     });`,
    // Not a section call at all.
    `for (const record of records) {
       logger.info(record.id);
     }`,
  ],
  invalid: [
    {
      code: `for (const record of records) {
               logger.section(record.id);
               logger.sectionEnd({ label: record.id });
             }`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    {
      code: `for (const key in records) { logger.section(key); }`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    {
      code: `for (let index = 0; index < records.length; index += 1) { logger.section("one"); }`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    {
      code: `while (hasMore) { logger.section("page"); }`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    {
      code: `do { logger.section("page"); } while (hasMore);`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    {
      code: `for await (const record of records) { logger.section(record.id); }`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    // An iteration callback repeats just as much as a `for` body.
    {
      code: `records.forEach((record) => { logger.section(record.id); });`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    {
      code: `await Promise.all(records.map(async (record) => { logger.section(record.id); }));`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    // A helper defined and called inside the loop still runs per iteration.
    {
      code: `for (const record of records) {
               const start = () => { logger.section(record.id); };
               start();
             }`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    // Reported once per section call, not once per enclosing loop.
    {
      code: `for (const batch of batches) {
               for (const record of batch) {
                 logger.section(record.id);
               }
             }`,
      errors: [{ messageId: "sectionInLoop" }],
    },
    // Any receiver whose name ends in "logger".
    {
      code: `for (const record of records) { context.logger.section(record.id); }`,
      errors: [{ messageId: "sectionInLoop" }],
    },
  ],
});
