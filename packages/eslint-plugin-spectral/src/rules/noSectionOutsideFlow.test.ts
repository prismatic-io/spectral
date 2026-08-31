import rule from "./noSectionOutsideFlow";
import { ruleTester } from "./ruleTester";

const handlerList = "onExecution, onTrigger, onDeployTrigger, onInstanceDeploy, onInstanceDelete";

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
    // Every handler that receives a code-native logger is allowed.
    `flow({ onTrigger: async () => { logger.section("t"); logger.sectionEnd({ label: "t" }); } });`,
    `flow({ onInstanceDeploy: async () => { logger.section("d"); logger.sectionEnd({ label: "d" }); } });`,
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
    {
      code: `const runFlow = async () => { logger.section("one"); };`,
      options: [{ handlers: ["runFlow"] }],
    },
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
        { messageId: "outsideFlow", data: { name: "section", handlerList } },
        { messageId: "outsideFlow", data: { name: "sectionEnd", handlerList } },
      ],
    },
    {
      code: `function syncOrders() {
               logger.section("orders");
             }`,
      errors: [{ messageId: "outsideFlow", data: { name: "section", handlerList } }],
    },
    {
      // Module scope is not a handler either.
      code: `logger.section("one");`,
      errors: [{ messageId: "outsideFlow" }],
    },
    {
      code: `const onExecution = async () => { logger.section("one"); };`,
      options: [{ handlers: ["onTrigger"] }],
      errors: [{ messageId: "outsideFlow" }],
    },
  ],
});
