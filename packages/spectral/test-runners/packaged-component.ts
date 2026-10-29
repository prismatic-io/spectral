// Deliberately bundles its own SDK copy, like a published component artifact.
import {
  action,
  callableComponent,
  component,
  connection,
  dataSource,
  input,
  trigger,
} from "@prismatic-io/spectral";

const display = {
  label: "Packaged CRM",
  description: "Package smoke fixture",
  iconPath: "icon.png",
};

const forbidden = () => {
  throw new Error("Packaged component performed real I/O");
};

export const definition = component({
  key: "packaged-crm",
  display,
  actions: {
    createContact: action({
      display,
      inputs: {
        email: input({ type: "string", label: "Email", required: true, clean: forbidden }),
      },
      perform: forbidden,
      examplePayload: { data: { id: "contact-example" } },
    }),
    deleteContact: action({ display, inputs: {}, perform: forbidden }),
  },
  dataSources: {
    accounts: dataSource({
      display,
      inputs: {},
      dataSourceType: "picklist",
      perform: forbidden,
      examplePayload: { result: [{ key: "account-1", label: "Account One" }] },
    }),
  },
  triggers: {
    webhook: trigger({
      display,
      inputs: {},
      scheduleSupport: "invalid",
      synchronousResponseSupport: "valid",
      perform: forbidden,
      onInstanceDeploy: forbidden,
      onInstanceDelete: forbidden,
    }),
  },
  connections: [
    connection({
      key: "apiKey",
      display,
      inputs: { apiKey: input({ type: "password", label: "API key" }) },
    }),
  ],
  hooks: { error: forbidden },
});
export const crm = callableComponent(definition);

// A helper captured before the consumer starts its test.
const createContact = crm.actions.createContact;
export const onboard = (email: string) => createContact({ email });
