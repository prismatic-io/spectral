const { flow } = require("../dist/index.js");
const { createHarness, defaultTriggerPayload } = require("../dist/testing.js");

exports.packagedContract = ({ test, expect }, load) => {
  test("mocks a separately bundled npm component's captured helper without registration", async () => {
    const { crm, onboard } = await load();
    const harness = createHarness(
      flow({
        name: "Onboard",
        stableKey: "onboard",
        onExecution: () => onboard("new@example.com"),
      }),
    );

    expect((await harness.run()).result).toEqual({ data: { id: "contact-example" } });
    expect(harness.mock(crm.actions.createContact)).toHaveBeenCalledWith({
      email: "new@example.com",
    });
    harness.mock(crm.actions.createContact).mockResolvedValue({ data: { id: "contact-specific" } });

    expect((await harness.run()).result).toEqual({ data: { id: "contact-specific" } });
    expect(await harness.invoke(() => crm.actions.deleteContact())).toBeUndefined();
  });

  test("keeps packaged configuration factories real while mocking their execution", async () => {
    const { crm } = await load();
    const harness = createHarness(
      flow({ name: "Config", stableKey: "config", onExecution: async () => ({ data: true }) }),
    );

    const connection = crm.connections.apiKey({
      stableKey: "crm-connection",
      values: { apiKey: { value: "test-key" } },
    });

    expect(connection.connection.component).toBe("packaged-crm");
    const options = crm.dataSources.accounts({ stableKey: "crm-account", values: {} });

    expect(await harness.configuration((context) => options.perform(context, {}))).toEqual({
      result: [{ key: "account-1", label: "Account One" }],
    });

    expect(harness.mock(crm.dataSources.accounts.perform)).toHaveBeenCalledTimes(1);
  });

  test("overrides packaged triggers and lifecycle methods using consumer SDK scopes", async () => {
    const { crm } = await load();
    const harness = createHarness(
      flow({
        name: "Webhook",
        stableKey: "webhook",
        onTrigger: crm.triggers.webhook(),
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );

    const payload = { ...defaultTriggerPayload(), body: { data: { contactId: "contact-42" } } };
    harness.mock(crm.triggers.webhook.perform).mockResolvedValue({ payload });

    expect((await harness.run()).result).toEqual({ data: { contactId: "contact-42" } });
    harness
      .mock(crm.triggers.webhook.onInstanceDeploy)
      .mockResolvedValue({ instanceState: { webhookId: "wh-1" } });

    expect(await harness.onInstanceDeploy()).toEqual({ instanceState: { webhookId: "wh-1" } });
    expect(await harness.onInstanceDelete()).toBeUndefined();
    expect(harness.mock(crm.triggers.webhook.onInstanceDelete)).toHaveBeenCalledTimes(1);
  });
  test("discovers batches through packaged callable mocks, including initial sync", async () => {
    const { crm } = await load();
    const harness = createHarness(
      flow({
        name: "Batch",
        stableKey: "batch",
        onTrigger: crm.triggers.batch(),
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );

    const payload = defaultTriggerPayload();
    harness.mock(crm.triggers.batch.perform).mockResolvedValue({ payload });
    harness.mock(crm.triggers.batch.triggerResolver.resolveItems).mockReturnValue([1, 2, 3]);
    harness.mock(crm.triggers.batch.triggerResolver.getNextPaginationState).mockReturnValue(null);

    expect((await harness.run()).results).toEqual([{ data: [1, 2] }, { data: [3] }]);
    harness.mock(crm.triggers.batch.onDeployPerform).mockResolvedValue({ payload });
    harness.mock(crm.triggers.batch.onDeployResolver.resolveItems).mockReturnValue(["initial"]);
    harness.mock(crm.triggers.batch.onDeployResolver.getNextPaginationState).mockReturnValue(null);

    expect((await harness.initialSync()).results).toEqual([{ data: ["initial"] }]);
    expect(harness.mock(crm.triggers.batch.triggerResolver.resolveItems)).toHaveBeenCalledTimes(1);
    expect(harness.mock(crm.triggers.batch.onDeployResolver.resolveItems)).toHaveBeenCalledTimes(1);
  });
};
