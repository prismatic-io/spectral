import path from "path";
import Generator from "yeoman-generator";
import { camelCase, merge } from "lodash";

class IntegrationGenerator extends Generator {
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
      description: "Name of Integration",
      alias: "n",
    });
    this.option("description", {
      type: String,
      description: "Description of Integration",
      alias: "d",
    });
    this.option("connectionType", {
      type: String,
      description: "Type of Connection",
      alias: "t",
    });
  }

  connectionLabel = "Connection 1";
  flowName = "Flow 1";

  initializing() {
    this.composeWith(require.resolve("../flow"), {
      destinationPath: path.join("src", "flows.ts"),
      name: this.flowName,
      description: "This is the first Flow",
    });
    this.composeWith(require.resolve("../connection"), {
      destinationPath: path.join("src", "connections.ts"),
      label: this.connectionLabel,
      comments: "This is a connection",
      connectionType: this.options.connectionType,
    });
  }

  async prompting() {
    this.answers = await this.prompt([
      {
        type: "input",
        name: "name",
        message: "Name of Integration",
        when: () => !Boolean(this.options.name),
      },
      {
        type: "input",
        name: "description",
        message: "Description of Integration",
        when: () => !Boolean(this.options.description),
      },
    ]);

    merge(this.answers, this.options);
  }

  async writing() {
    const { name, description } = this.answers;
    const context = {
      integration: { name, description, key: camelCase(name) },
      connection: { key: camelCase(this.connectionLabel) },
      flow: { name: this.flowName },
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
        import: "npm run build && prism integrations:import",
        test: "jest",
        lint: "eslint --ext .ts .",
      },
      eslintConfig: {
        root: true,
        extends: ["@prismatic-io/eslint-config-spectral"],
      },
    });

    await this.addDependencies("@prismatic-io/spectral");
    await this.addDevDependencies([
      "eslint",
      "@prismatic-io/eslint-config-spectral",
    ]);
    await this.addDevDependencies({
      "@types/jest": "26.0.24",
      "copy-webpack-plugin": "11.0.0",
      jest: "27.0.6",
      "ts-jest": "27.0.3",
      "ts-loader": "9.2.3",
      typescript: "4.3.5",
      webpack: "5.76.3",
      "webpack-cli": "5.0.1",
    });
  }
}

module.exports = IntegrationGenerator;
