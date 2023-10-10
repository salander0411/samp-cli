const program = require("commander");
const generate = require("./generate");
program
  .command("generate")
  .alias("g")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .option("-q, --query [query]", "Question to ask. I.e \"a lambda function that's triggered by an S3 event\"")
  .option("-m, --model [model]", "Claude model to use. Valid values are 'anthropic.claude-v1' and 'anthropic.claude-instant-v1' and 'anthropic.claude-v2' ", "anthropic.claude-v2")
  .option("-o, --output [output]", "Output feature. Valid values are 'SAM', 'CDK', 'lambda-<language>' or 'ASL'. If not 'SAM', set --output-file", "SAM")
  .option("-of, --output-file [output-file]", "Output file. Only applicable if --output is CDK")
  .description("Generates resources from a Claude response")
  .action(async (cmd) => {
    await generate.run(cmd);
  });
