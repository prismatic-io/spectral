import Generator from "yeoman-generator";
import { camelCase, merge } from "lodash";

class DataSourceGenerator extends Generator {
  answers!: { label: string; description: string };

  constructor(
    args: string | string[],
    options: Generator.GeneratorOptions,
    features: Generator.GeneratorFeatures | undefined
  ) {
    super(args, options, features);

    this.option("label", {
      type: String,
      description: "Label of Data Source",
      alias: "l",
    });
    this.option("description", {
      type: String,
      description: "Description of Data Source",
      alias: "d",
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
        message: "Label of Data Source",
        when: () => !Boolean(this.options.label),
      },
      {
        type: "input",
        name: "description",
        message: "Description of Data Source",
        when: () => !Boolean(this.options.description),
      },
    ]);

    merge(this.answers, this.options);
  }

  async writing() {
    const { label, description } = this.answers;
    const key = camelCase(label);
    const context = {
      dataSource: { label, description, key },
    };

    const destination = this.options.destinationPath || `${key}.ts`;
    this.renderTemplate("dataSource.ts", destination, context);
  }
}

module.exports = DataSourceGenerator;
