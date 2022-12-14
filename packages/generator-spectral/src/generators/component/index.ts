import path from "path";
import Generator from "yeoman-generator";
import { camelCase, merge } from "lodash";

class ComponentGenerator extends Generator {
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
      description: "Name of Component",
      alias: "n",
    });
    this.option("description", {
      type: String,
      description: "Description of Component",
      alias: "d",
    });
    this.option("connectionType", {
      type: String,
      description: "Type of Connection",
      alias: "t",
    });
  }

  initializing() {
    this.composeWith(require.resolve("../action"), {
      destinationPath: path.join("src", "actions.ts"),
      label: "My Action",
      description: "This is my action",
    });
    this.composeWith(require.resolve("../trigger"), {
      destinationPath: path.join("src", "triggers.ts"),
      label: "My Trigger",
      description: "This is my trigger",
    });
    this.composeWith(require.resolve("../dataSource"), {
      destinationPath: path.join("src", "dataSources.ts"),
      label: "My Data Source",
      description: "This is my data source",
    });
    this.composeWith(require.resolve("../connection"), {
      destinationPath: path.join("src", "connections.ts"),
      label: "My Connection",
      comments: "This is my connection",
      connectionType: this.options.connectionType,
    });
  }

  async prompting() {
    this.answers = await this.prompt([
      {
        type: "input",
        name: "name",
        message: "Name of Component",
        when: () => !Boolean(this.options.name),
      },
      {
        type: "input",
        name: "description",
        message: "Description of Component",
        when: () => !Boolean(this.options.description),
      },
    ]);

    merge(this.answers, this.options);
  }

  async writing() {
    const { name, description } = this.answers;
    const context = {
      component: { name, description, key: camelCase(name) },
    };

    const templateFiles = [
      ["assets", "icon.png"],
      ["src", "index.ts"],
      ["src", "index.test.ts"],
      ["src", "client.ts"],
      "jest.config.js",
      "package.json",
      "tsconfig.json",
      "webpack.config.js",
    ];
    const templates = templateFiles.map<Generator.TemplateRenderOptions<this>>(
      (f) => ({ source: f, destination: f })
    );
    this.renderTemplates(templates, context);

    this.packageJson.merge({
      scripts: {
        build: "webpack",
        publish: "npm run build && prism components:publish",
        test: "jest",
        lint: "eslint --ext .ts .",
      },
      eslintConfig: {
        root: true,
        extends: ["@prismatic-io/eslint-config-spectral"],
      },
    });

    await this.addDependencies("@prismatic-io/spectral");
    await this.addDevDependencies("@prismatic-io/eslint-config-spectral");
    await this.addDevDependencies({
      "@types/jest": "26.0.24",
      "copy-webpack-plugin": "11.0.0",
      jest: "27.0.6",
      "ts-jest": "27.0.3",
      "ts-loader": "9.2.3",
      typescript: "4.3.5",
      webpack: "5.75.0",
      "webpack-cli": "5.0.1",
      eslint: "6.8.0",
    });
  }
}

module.exports = ComponentGenerator;
