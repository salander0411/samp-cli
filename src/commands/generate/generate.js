const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const settingsUtil = require("../../shared/settingsUtil");
const fs = require("fs-extra");
var Spinner = require('cli-spinner').Spinner;
const baseFile = require("../../shared/baseFile.json");
const JSON= require("JSON");
var util= require('util');
const utf8Decoder = new util.TextDecoder("utf-8", { ignoreBOM: true });

var spinner = new Spinner('Waiting for Claude... %s');
spinner.setSpinnerString('|/-\\');

const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

async function run(cmd) {
  console.log("*** Note: This is an experimental feature and depends on the BedRock Claude v1.3 API. Make sure you review the output carefully before using it in production ***")
  const output = cmd.output.toLowerCase();
  if (output !== "sam" && !cmd.outputFile) {
    console.log(`You need to specify an output file with --output-file`);
    return;
  }

  let ownTemplate;
  if (output === "sam") {
    if (!fs.existsSync(cmd.template)) {
      console.log(
        `Can't find ${cmd.template}. Use -t option to specify template filename`
      );
      const create = await inputUtil.prompt(`Create ${cmd.template}?`);
      if (create) {
        fs.writeFileSync(cmd.template, parser.stringify("yaml", baseFile));
      } else {
        return;
      }
    }

    ownTemplate = parser.parse("own", fs.readFileSync(cmd.template));
    ownTemplate.Resources = ownTemplate.Resources || {};
  }

  let outputString;
  let language;
  switch (output.substring(0, 3)) {
    case "sam":
      outputString = "SAM JSON";
      break;
    case "cdk":
      outputString = "TypeScript CDK";
      break;
    case "lam":
      outputString = "Lambda";
      language = output.split("-")[1];
      if (language) {
        outputString += ` in ${language}`;
      }

      break;
    case "asl":
      outputString = "StepFunctions ASL YAML";
      break;
    default:
      console.log(`Invalid output format ${output}. Valid values are 'SAM', 'CDK', 'lambda-<language>' or 'ASL'`);
      return;
  }
  const prompt = `Generate this in AWS ${outputString}: ${cmd.query}. Only return code.`;

  const claudeBody = JSON.stringify({
        "prompt": "\n\nHuman:" + prompt +"\n\nAssistant:",
        "temperature": 0.5,
        "top_p": 1,
        "top_k": 250,
        "max_tokens_to_sample": 400,
        "stop_sequences": ["\n\nHuman:"]
      }
  )

  const claudeRequest = {
    body: claudeBody,
    modelId: 'anthropic.claude-v1',
    accept: 'application/json',
    contentType: 'application/json'
  };

  spinner.start();

  //call bedrock API to generate response
  const bedrockclient = new BedrockRuntimeClient({
    region: "us-east-1",
    profile: "global"
  });

  const command = new InvokeModelCommand(claudeRequest);
  const response = await bedrockclient.send(command);

  spinner.stop();

  let text = JSON.parse(utf8Decoder.decode(response.body)).completion;

  //console.log(typeof text); // string

  // get the first JSON object in the text
  let obj;
  if (output === "sam") {
    try {
      obj = JSON.parse(text.replace(/\n/g, '').replace(/```/g, '').match(/{.*}/)[0]);
      console.log("output is sam, obj is", obj);
    } catch (e) {
      try {
        obj = parser.parse("yaml", text);
      } catch (e) {
        console.log(`Couldn't parse the output from Claude. Try again. The output was: \n${text}\n\nThe error was: ${e}`);
        return;
      }
    }
    if (obj.Resources) {
      obj = obj.Resources;
    }

    console.log(`\n\nGenerated the following resources:\n\n${parser.stringify("yaml", obj)}`);
  } else {
    console.log("output not sam, text is ",text);
    //check if text has a row starting with ``` followed by text. If so, remove that text
    const match = text.match(/```.+\n/);
    if (match && match[0]) {
      text = text.replace(match[0], '```\n');
    }
    if (text.match(/```/g)) {
      text = text.replace(/\n/g, "¶").match(/```.*```/)[0].split("¶").join('\n').replace(/```/g, '');
    }
    console.log(`\n\nGenerated the following ${language} code:\n\n${text}`);
  }
  const cont = await inputUtil.prompt(output === "sam" ? `Add to template?` : `Add to ${cmd.outputFile}?`);
  if (!cont) {
    return;
  }

  if (output !== "sam") {
    if (!cmd.outputFile) {
      console.log(`You need to specify an output file with --output-file`);
      return;
    }
    if (fs.existsSync(cmd.outputFile)) {
      const cont = await inputUtil.prompt(`Overwrite ${cmd.outputFile}?`);
      if (!cont) {
        return;
      }
    }
    fs.writeFileSync(cmd.outputFile, text);
    return;
  }

  for (const key in obj) {
    if (ownTemplate.Resources[key]) {
      console.log(
        `Resource ${key} already exists in ${cmd.template}. Renaming to ${key}_2.`
      );
      obj[`${key}_2`] = obj[key];
      delete obj[key];
    }
  }
  const newTemplate = {
    ...ownTemplate,
    Resources: {
      ...ownTemplate.Resources,
      ...obj
    }
  }
  fs.writeFileSync(cmd.template, parser.stringify("own", newTemplate));

  console.log(
    `${cmd.template} updated with ${cmd.query}. You'll want to sanity check the output to make sure it's correct.`
  );
}

module.exports = {
  run,
};
