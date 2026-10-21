import {
  action,
  callableComponent,
  component,
  dataSource,
  flow,
  input,
  trigger,
} from "@prismatic-io/spectral";
import { createHarness, type FunctionMock } from "@prismatic-io/spectral/testing";
import { expectError, expectType } from "tsd";

const display = { label: "Fixture", description: "Fixture", iconPath: "icon.png" };
const source = component({
  key: "typed-mocks",
  display,
  actions: {
    send: action({
      display,
      inputs: {
        message: input({ type: "string", label: "Message", required: true }),
        count: input({ type: "number", label: "Count" }),
      },
      perform: async (_context, params) => ({
        data: { sent: String(params.message), count: params.count, tags: ["customer"] as string[] },
      }),
    }),
  },
  dataSources: {
    options: dataSource({
      display,
      inputs: {},
      dataSourceType: "string",
      perform: async () => ({ result: "options" }),
    }),
  },
  triggers: {
    event: trigger({
      display,
      inputs: {},
      scheduleSupport: "invalid",
      synchronousResponseSupport: "valid",
      perform: async (_context, payload) => ({ payload }),
      onInstanceDeploy: async () => ({ instanceState: { deployed: true } }),
    }),
  },
});

const calls = callableComponent(source);
const tested = flow({
  name: "Typed",
  stableKey: "typed",
  onExecution: async () => ({ data: true }),
});

const harness = createHarness(tested);
const mock = harness.mock(calls.actions.send);
expectType<FunctionMock<typeof calls.actions.send>>(mock);
mock.mockImplementation(async ({ message, count }) => {
  expectType<string>(message);
  expectType<string | number | undefined>(count);

  return { data: { sent: message, count: Number(count), tags: [] } };
});
const response = { data: { sent: "yes", count: 3, tags: ["prospect"] } };
mock.mockResolvedValue(response);
expectError(mock.mockResolvedValue({ data: { sent: false, count: 3, tags: [] } }));
expectError(mock.mockResolvedValue({ data: { sent: "yes", tags: [] } }));
expectError(
  mock.mockImplementation(async ({ missing }) => ({ data: { sent: missing, count: 1, tags: [] } })),
);
expectError(harness.mock(calls.actions.missing));
expectError(mock({ count: 1 }));
expectType<string>(mock.mock.calls[0][0].message);
harness.mock(calls.dataSources.options.perform).mockResolvedValue({ result: "example" });
expectError(
  harness.mock(calls.dataSources.options.perform).mockResolvedValue({ data: "wrong envelope" }),
);

if (calls.triggers.event.onInstanceDeploy) {
  harness
    .mock(calls.triggers.event.onInstanceDeploy)
    .mockResolvedValue({ instanceState: { deployed: false } });
}
expectError(
  harness.mock(calls.triggers.event.perform).mockResolvedValue({ data: "not a trigger result" }),
);
expectError(createHarness(source).mock(calls.actions.send));
expectError(createHarness(source).run());
expectError(harness.action("send"));

expectType<typeof mock>(mock.mockResolvedValueOnce(response).mockClear());
expectType<typeof mock>(mock.mockRejectedValueOnce(new Error("retry")));
mock.mockImplementationOnce(async ({ message }) => {
  expectType<string>(message);

  return { data: { sent: message, count: 1, tags: [] } };
});
expectError(mock.mockResolvedValueOnce({ data: { sent: 123, count: 1, tags: [] } }));
expectError(mock.mockResolvedValueOnce({ data: { sent: "yes", count: 1, tags: [3] } }));
expectError(
  mock.mockImplementationOnce(async ({ message }: { message: number }) => ({
    data: { ...response.data, sent: String(message) },
  })),
);
expectError(mock.mockReturnValue(response));
mock.mockReturnValue(Promise.resolve(response));
expectType<Promise<string>>(harness.invoke(async () => "typed result"));
expectType<Promise<number>>(harness.invoke(() => 42));
expectType<Promise<boolean>>(harness.configuration(() => true));

declare const sync: FunctionMock<(key: string, count?: number) => { found: boolean }>;
expectType<string>(sync.mock.calls[0][0]);
expectType<number | undefined>(sync.mock.calls[0][1]);
sync.mockReturnValue({ found: true });
sync.mockReturnValueOnce({ found: false });
sync.mockImplementation((key, count) => ({ found: key.length > (count ?? 0) }));
expectError(sync.mockResolvedValue({ found: false }));
expectError(sync.mockResolvedValueOnce({ found: false }));
expectError(sync.mockRejectedValue(new Error("sync")));
expectError(sync.mockReturnValue({ found: "yes" }));
expectError(sync(123));
