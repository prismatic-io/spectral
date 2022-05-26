import path from "path";
import { camelCase } from "lodash";
import Generator from "yeoman-generator";
import { read } from "./readers/openapi";
import { write } from "./writer";

class FormatsGenerator extends Generator {
  values: {
    key: string;
    name: string;
    icon?: string;
    openapi: string;
  };

  constructor(
    args: string | string[],
    options: Generator.GeneratorOptions,
    features: Generator.GeneratorFeatures | undefined
  ) {
    super(args, options, features);
    this.values = { key: "", name: "", openapi: "" };

    this.option("name", {
      type: String,
      description: "Name of Component",
      alias: "n",
    });
    this.option("icon", {
      type: String,
      description: "Path to png icon to use",
      alias: "i",
    });
    this.option("openapi", {
      type: String,
      description: "Path to OpenAPI specification to generate from",
    });
  }

  async initializing() {
    if (!this.options.openapi) {
      throw new Error("Path to OpenAPI specification must be specified.");
    }

    if (this.options.icon && !this.fs.exists(this.options.icon)) {
      throw new Error("Specified png icon does not exist.");
    }

    this.values = {
      key: camelCase(this.options.name),
      name: this.options.name,
      icon: this.options.icon,
      openapi: this.options.openapi,
    };
  }

  async writing() {
    this.renderTemplate("tsconfig.json");
    this.renderTemplate("webpack.config.js");
    this.renderTemplate(["assets", "icon.png"]);

    this.packageJson.merge({
      name: this.values.key,
      private: true,
      scripts: {
        build: "webpack",
        test: "jest",
        lint: "eslint --quiet --ext .ts .",
        "lint-fix": "eslint --quiet --ext .ts --fix .",
        format: "npm run lint-fix && prettier --loglevel error --write .",
      },
      eslintConfig: {
        root: true,
        extends: ["@prismatic-io/eslint-config-spectral"],
      },
    });

    await this.addDependencies("@prismatic-io/spectral");
    await this.addDevDependencies("@prismatic-io/eslint-config-spectral");
    await this.addDevDependencies({
      "@types/jest": "25.2.3",
      "copy-webpack-plugin": "10.2.4",
      jest: "26.6.3",
      "ts-jest": "26.4.0",
      "ts-loader": "9.3.0",
      typescript: "4.6.3",
      webpack: "5.72.0",
      "webpack-cli": "4.9.2",
      eslint: "6.8.0",
      prettier: "2.0.5",
    });

    const result = await read(this.values.openapi);
    await write(this.values.key, result);

    if (this.values.icon) {
      this.fs.copy(this.values.icon, path.join("assets", "icon.png"));
    }
  }

  async end() {
    this.log("\nFormatting code...\n\n");
    this.spawnCommandSync("npm", ["run", "format"], { stdio: "ignore" });

    this.log.ok(`"${this.values.name}" is ready for development.`);
    this.log(`
To install or update dependencies, run either "npm install" or "yarn install"
To build the component, run "npm run build" or "yarn run build"
To test the component, run "npm run test" or "yarn run test"
To publish the component, run "prism components:publish"

For documentation on writing custom components, visit https://prismatic.io/docs/custom-components/writing-custom-components/`);
  }
}

module.exports = FormatsGenerator;
