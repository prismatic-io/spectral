import path from "path";
import Generator from "yeoman-generator";
import { camelCase, merge } from "lodash";

class FlowGenerator extends Generator {
  answers!: {
    name: string;
    description: string;
  };

  constructor(
    args: string | string[],
    options: Generator.GeneratorOptions,
    features: Generator.GeneratorFeatures | undefined
  ) {
    super(args, options, features);

    this.option("name", {
      type: String,
      description: "Name of Flow",
      alias: "n",
    });
    this.option("description", {
      type: String,
      description: "Description of Flow",
      alias: "d",
    });
  }

  async prompting() {
    this.answers = await this.prompt([
      {
        type: "input",
        name: "name",
        message: "Name of Flow",
        when: () => !Boolean(this.options.name),
      },
      {
        type: "input",
        name: "description",
        message: "Description of Flow",
        when: () => !Boolean(this.options.description),
      },
    ]);

    merge(this.answers, this.options);
  }

  async writing() {
    const { name, description } = this.answers;
    const key = camelCase(name);
    const context = {
      flow: { name, key, description },
    };

    const destination = this.options.destinationPath || `${key}.ts`;
    this.renderTemplate("flow.ts", destination, context);
  }
}

module.exports = FlowGenerator;
