import rule from "./noSectionOutsideFlow";
import { ruleTester } from "./ruleTester";

ruleTester.run("no-section-outside-flow", rule, {
  valid: [
    `export const syncFlow = flow({
       onExecution: async (context) => {
         const { logger } = context;
         logger.section("one");
         logger.sectionEnd({ label: "one" });
       },
     });`,
    // A loop body is not a function boundary.
    `flow({
       onExecution: async (context) => {
         for (const record of records) {
           logger.section(record.id);
           logger.sectionEnd({ label: record.id });
         }
       },
     });`,
    // An inline callback hides nothing: it is still visible in the flow body.
    `flow({
       onExecution: async (context) => {
         items.forEach((item) => {
           logger.section(item.id);
           logger.sectionEnd({ label: item.id });
         });
       },
     });`,
    // A handler declared separately and passed in by name.
    `const onExecution = async (context) => {
       logger.section("one");
       logger.sectionEnd({ label: "one" });
     };
     flow({ onExecution });`,
    `async function onExecution(context) {
       logger.section("one");
       logger.sectionEnd({ label: "one" });
     }`,
    `flow({ "onExecution": async () => { logger.section("one"); } });`,
    // Shorthand method form.
    `flow({
       onExecution(context) {
         logger.section("one");
         logger.sectionEnd({ label: "one" });
       },
     });`,
    // Not a section call at all.
    `const helper = () => { logger.info("hi"); };`,
  ],
  invalid: [
    {
      code: `const syncCustomers = async (logger) => {
               logger.section("customers");
               logger.sectionEnd({ label: "customers" });
             };`,
      errors: [
        { messageId: "outsideFlow", data: { name: "section" } },
        { messageId: "outsideFlow", data: { name: "sectionEnd" } },
      ],
    },
    {
      code: `function syncOrders() {
               logger.section("orders");
             }`,
      errors: [{ messageId: "outsideFlow", data: { name: "section" } }],
    },
    {
      // Module scope is not a handler either.
      code: `logger.section("one");`,
      errors: [{ messageId: "outsideFlow" }],
    },
    {
      // A helper is a helper no matter what it is named.
      code: `const runFlow = async () => { logger.section("one"); };`,
      errors: [{ messageId: "outsideFlow", data: { name: "section" } }],
    },
    {
      // Other flow handlers do not receive a logger with section methods.
      code: `flow({ onTrigger: async () => { logger.section("t"); } });`,
      errors: [{ messageId: "outsideFlow", data: { name: "section" } }],
    },
    {
      code: `flow({ onInstanceDeploy: async () => { logger.section("d"); } });`,
      errors: [{ messageId: "outsideFlow", data: { name: "section" } }],
    },
  ],
});
