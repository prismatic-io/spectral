import Generator from "yeoman-generator";
import { camelCase, merge } from "lodash";

const connectionTypes = {
  basic: "Basic Connection",
  oauth: "OAuth 2.0",
};
type ConnectionType = keyof typeof connectionTypes;

class ConnectionGenerator extends Generator {
  answers!: { label: string; comments: string; connectionType: ConnectionType };

  constructor(
    args: string | string[],
    options: Generator.GeneratorOptions,
    features: Generator.GeneratorFeatures | undefined
  ) {
    super(args, options, features);

    this.option("label", {
      type: String,
      description: "Label of Connection",
      alias: "l",
    });
    this.option("comments", {
      type: String,
      description: "Comments of Connection",
      alias: "c",
    });
    this.option("destinationPath", {
      type: String,
      description: "Override destination path within root",
      hide: true,
    });
  }

  async prompting() {
    this.answers = await this.prompt([
      {
        type: "input",
        name: "label",
        message: "Label of Connection",
        when: () => !Boolean(this.options.label),
      },
      {
        type: "input",
        name: "comments",
        message: "Comments of Connection",
        when: () => !Boolean(this.options.comments),
      },
      {
        type: "list",
        name: "connectionType",
        message: "Type of Connection",
        choices: Object.entries(connectionTypes).map(([key, label]) => ({
          name: label,
          value: key,
        })),
      },
    ]);

    merge(this.answers, this.options);
  }

  async writing() {
    const { label, comments, connectionType } = this.answers;
    const key = camelCase(label);
    const context = {
      connection: { label, comments, key },
    };

    const destination = this.options.destinationPath || `${key}.ts`;
    this.renderTemplate(`${connectionType}.ts`, destination, context);
  }
}

module.exports = ConnectionGenerator;
