const program = require("commander");
const describe = require("./describe");
program
  .command("describe")
  .alias("d")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .option("-r, --repository-path [repository]", "Github repository path, i.e \"aws-samples/serverless-patterns/apigw-sfn\"")
  .option("-m, --model [model]", "Claude model to use. Valid values are 'anthropic.claude-v1' and 'anthropic.claude-instant-v1' and 'anthropic.claude-v2'.", "anthropic.claude-v2")
  .option("--🥚", "Easter egg")
  .description("Describes a SAM template using Claude")
  .action(async (cmd) => {
    await describe.run(cmd);
  });
