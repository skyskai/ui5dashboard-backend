const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const nodemailer = require('nodemailer');
const json2html = require('node-json2html');
const WebSocket = require('ws');
const REQUIRE_AUTH = true
const AUTH_TOKEN = 'ysc-token';
//10. Settings
app.use(bodyParser.json())
app.set('port', (process.env.PORT || 5000))
//20. WebSocket
var url = "wss://websocket3347.herokuapp.com";
var ws = new WebSocket(url);
//30. 요청 처리
app.post('/dashboard',function(request,response){
  // Log the request header and body coming from API.AI to help debug issues.
  // See https://api.ai/docs/fulfillment#request for more.
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

  // An action is a string used to identify what tasks needs to be done
  // in fulfillment usally based on the corresponding intent.
  // See https://api.ai/docs/actions-and-parameters for more.
  let action = request.body.result.action;

  // Parameters are any entites that API.AI has extracted from the request.
  // See https://api.ai/docs/actions-and-parameters for more.
  const parameters = request.body.result.parameters;

  // Contexts are objects used to track and store conversation state and are identified by strings.
  // See https://api.ai/docs/contexts for more.
  const contexts = request.body.result.contexts;
   let responseJson = {};
  const actionHandlers = {
    'input.welcome': () => {
      // The default welcome intent has been matched, Welcome the user.
      // Define the response users will hear
      responseJson.speech = 'Hello, welcome to my API.AI agent';
      // Define the response users will see
      responseJson.displayText = 'Hello! Welcome to my API.AI agent :-)';
      // Send the response to API.AI
      response.json(responseJson);
    },
    'input.unknown': () => {
      // The default fallback intent has been matched, try to recover.
      // Define the response users will hear
      responseJson.speech = 'I\'m having trouble, can you try that again?';
      // Define the response users will see
      responseJson.displayText = 'I\'m having trouble :-/ can you try that again?';
      // Send the response to API.AI
      response.json(responseJson);
    },
    'default': () => {
      // This is executed if the action hasn't been defined.
      // Add a new case with your action to respond to your users' intent!
      responseJson.speech = 'This message is from API.AI\'s Cloud Functions for Firebase editor!';
      responseJson.displayText = 'This is from API.AI\'s Cloud Functions for Firebase editor!';

      // Optional: add rich messages for Google Assistant, Facebook and Slack defined below.
      // Uncomment next line to enable. See https://api.ai/docs/rich-messages for more.
      //responseJson.data = richResponses;

      // Optional: add outgoing context(s) for conversation branching and flow control.
      // Uncomment next 2 lines to enable. See https://api.ai/docs/contexts for more.
      //let outgoingContexts = [{"name":"weather", "lifespan":2, "parameters":{"city":"Rome"}}];
      //responseJson.contextOut = outgoingContexts;

      // Send the response to API.AI
      response.json(responseJson);
    }
  };
  if (!actionHandlers[action]) {
   action = 'default';
 }

 // Map the action name to the correct action handler function and run the function
 actionHandlers[action]();

})
