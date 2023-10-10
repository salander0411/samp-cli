const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");

const settingsUtil = require("../../shared/settingsUtil");
const fs = require("fs-extra");
var Spinner = require('cli-spinner').Spinner;
const baseFile = require("../../shared/baseFile.json");
const githubUtil = require("../../shared/githubUtil");
var spinner = new Spinner('Waiting for Claude... %s');
spinner.setSpinnerString('|/-\\');

const JSON = require("JSON");
const util = require("util");
const utf8Decoder = new util.TextDecoder("utf-8", { ignoreBOM: true });
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const bedrockclient = new BedrockRuntimeClient({
  region: "us-east-1",
  profile: "global"
});

async function run(cmd) {
  let template
  if (!cmd.repositoryPath) {
    template = await fs.readFile(cmd.template, "utf8");

  } else {

    let path = "";
    let owner = "";
    let repo = "";
    if (cmd.repositoryPath.startsWith("https://github.com")) {
      if (cmd.repositoryPath.endsWith("/.yaml")) {
        cmd.template = cmd.repositoryPath.split("/").pop();
      }
      //https://github.com/aws-samples/serverless-patterns/tree/main/apigw-rest-stepfunction
      const httpPath = cmd.repositoryPath.replace("https://github.com/", "");
      const split = httpPath.split("/");
      owner = split[0];
      if (split.length > 1) {
        repo = split[1];
      }
      if (split.length > 3) {
        path = split[4];
      }
    } else {
      const split = cmd.repositoryPath.split("/");
      owner = split[0];
      repo = "";
      if (split.length > 1) {
        repo = split[1];
      }
      if (split.length > 2) {
        path = split[2];
      }
    }
    path += "/" + cmd.template;
    try {
    template = await githubUtil.getContent(owner, repo, path);
    } catch (e) {
      console.log("Couldn't find " + cmd.template + " in " + cmd.repositoryPath);
      return;
    }    
  }

  let easterEggPrompt = "";
  if (cmd["🥚"]) {
    const funWaysOfDescribingSOmethingBoring = [
      "as a romantic poem",
      "as a joke",
      "in the melody of God Save the Queen",
      "in the style of Ivor Cutler",
      "in the style of a 1980s computer game",
      "in the style of an angry teenager",
      "making heavy references to the Easter Bunny",
    ]
    easterEggPrompt =  funWaysOfDescribingSOmethingBoring[Math.floor(Math.random() * funWaysOfDescribingSOmethingBoring.length)];

    console.log("Alright, I'll do this " + easterEggPrompt);

    easterEggPrompt = " Do it " + easterEggPrompt;
  }

  const claudeBody = JSON.stringify({
        "prompt": "\n\nHuman:In three sections, describe what the template does, if there are any security issues and how it can be improved: " + template + "." + easterEggPrompt + "\n\nAssistant:",
        "temperature": 0.5,
        "top_p": 1,
        "top_k": 250,
        "max_tokens_to_sample": 400,
        "stop_sequences": ["\n\nHuman:"]
      }
  )

  const claudeRequest = {
    body: claudeBody,
    modelId: cmd.model,
    accept: 'application/json',
    contentType: 'application/json'
  };


  spinner.start();
  try {
    //call Claude Model to generate the response
    const command = new InvokeModelCommand(claudeRequest);
    const response = await bedrockclient.send(command);

    spinner.stop();
    let text = JSON.parse(utf8Decoder.decode(response.body)).completion;
    console.log(`\n\n${text}`);
    } catch (error) {
      spinner.stop();
      console.log("\n\n" + error.stack);
    }


}

module.exports = {
  run,
};
