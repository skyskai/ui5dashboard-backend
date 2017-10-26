const express = require('express')
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer');
const json2html = require('node-json2html');
const WebSocket = require('ws');
const DialogflowApp = require('actions-on-google').DialogflowApp; // Google Assistant helper library
const odata = require('odata-client');
const fs = require('fs');
const app = express();
const googleAssistantRequest = 'google'; // Constant to identify Google Assistant requests
const REQUIRE_AUTH = true
const AUTH_TOKEN = 'ysc-token';
//00. Raw 데이터 읽어
const sJSONFile = fs.readFileSync("./data/salesNorthwind.json");
const aSales = JSON.parse(sJSONFile);

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
  let requestOriginal = request.body.result.resolvedQuery;
  // Get the request source (Google Assistant, Slack, API, etc) and initialize DialogflowApp
   const requestSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;
   const apiaiApp = new DialogflowApp({request: request, response: response});
  // Parameters are any entites that API.AI has extracted from the request.
  // See https://api.ai/docs/actions-and-parameters for more.
  const parameters = request.body.result.parameters;


  // Contexts are objects used to track and store conversation state and are identified by strings.
  // See https://api.ai/docs/contexts for more.
  const contexts = request.body.result.contexts;
   let responseJson = {};
   // Create handlers for Dialogflow actions as well as a 'default' handler
  const actionHandlers = {
    //국가별
    'input.byCountry':() =>{
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('Heroku webhook action \'byCountry\' [Google]'); // Send simple response to user
      } else {
        sendResponse('Heroku webhook action \'byCountry\' '); // Send simple response to user
      }
    },
    //년도별
    'input.byYear':() =>{
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('Heroku webhook action \'byYear\' [Google]'); // Send simple response to user
      } else {
        sendResponse('Heroku webhook action \'byYear\' '); // Send simple response to user
      }
    },
    //SalesCategory(Country, Category, Product)와 년도 기준 Sales
    'input.SalesCategory_Year':() =>{
      if (requestSource === googleAssistantRequest) {
        responseJson.speech = 'Year is '+ parameters['Year'] + 'Sales Category is '+ parameters['SalesCategory'] ; // spoken response
        responseJson.displayText = responseJson.speech; // displayed response
        sendGoogleResponse(responseJson); // Send simple response to user
      } else {
        // responseJson.speech = 'Year is '+ parameters['Year'] + 'Sales Category is '+ parameters['SalesCategory'] ; // spoken response
        // responseJson.displayText = responseJson.speech; // displayed response
        let aResult = {};
        switch (parameters['SalesCategory']) {
          case 'Country':
            aResult = getDataByYear(aSales.SalesByCountry,parameters['Year'])
            break;
          case 'Category':
            aResult = getDataByYear(aSales.SalesByCategory,parameters['Year'])
            break;
          case 'Product':
            aResult = getDataByYear(aSales.SalesByProduct,parameters['Year'])
            break;
          default:

        }
        console.log(aResult);
        responseJson.speech = JSON.stringify(aResult);
        responseJson.displayText = responseJson.speech;
        sendResponse(responseJson);
        // var q = odata({service: 'http://services.odata.org/Northwind/Northwind.svc/'}).resource('Category_Sales_for_1997','Confections');
        // q.custom('$format','json').get().then(function(res) {
        //     console.log("##odata:");
        //
        //     let oResult = JSON.parse(res.body);
        //     console.log(oResult.CategorySales);
        //     responseJson.speech = oResult.CategorySales;
        //     responseJson.displayText = responseJson.speech;
        //     sendResponse(responseJson);
        //   });
      }
    },

    // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
    'input.welcome': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('Hello, Welcome to my Dialogflow agent! [Google]'); // Send simple response to user
      } else {
        sendResponse('Hello, Welcome to my Dialogflow agent!'); // Send simple response to user
      }
    },
    // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
    'input.unknown': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('I\'m having trouble, can you try that again? [Google]'); // Send simple response to user
      } else {
        sendResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
      }
    },
    // Default handler for unknown or undefined actions
    'default': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        let responseToUser = {
          //googleRichResponse: googleRichResponse, // Optional, uncomment to enable
          //googleOutputContexts: ['weather', 2, { ['city']: 'rome' }], // Optional, uncomment to enable
          speech: 'Your action is not defined yet! [Google]', // spoken response
          displayText: 'Your action is not defined yet! :-) [Google]' // displayed response
        };
        sendGoogleResponse(responseToUser);
      } else {
        let responseToUser = {
          //richResponses: richResponses, // Optional, uncomment to enable
          //outputContexts: [{'name': 'weather', 'lifespan': 2, 'parameters': {'city': 'Rome'}}], // Optional, uncomment to enable
          speech: 'Your action is not defined yet!', // spoken response
          displayText: 'Your action is not defined yet! :-)' // displayed response
        };
        sendResponse(responseToUser);
      }
    }
  };
  if (!actionHandlers[action]) {
   action = 'default';
 }

 // Map the action name to the correct action handler function and run the function
 actionHandlers[action]();
//Country, Category, Product의 년도별 Sales
 function getDataByYear(aSales,iYear){
 	let oFound = aSales.filter(function(obj){
 	if(obj.Year === iYear){
 		return obj;
 	}
   })
   return oFound;
 }


// Function to send correctly formatted Google Assistant responses to Dialogflow which are then sent to the user
 function sendGoogleResponse (responseToUser) {
   if (typeof responseToUser === 'string') {
     apiaiApp.ask(responseToUser); // Google Assistant response
   } else {
     // If speech or displayText is defined use it to respond
     let googleResponse = apiaiApp.buildRichResponse().addSimpleResponse({
       speech: responseToUser.speech || responseToUser.displayText,
       displayText: responseToUser.displayText || responseToUser.speech
     });

     // Optional: Overwrite previous response with rich response
     if (responseToUser.googleRichResponse) {
       googleResponse = responseToUser.googleRichResponse;
     }

     // Optional: add contexts (https://dialogflow.com/docs/contexts)
     if (responseToUser.googleOutputContexts) {
       apiaiApp.setContext(...responseToUser.googleOutputContexts);
     }
     //apiaiApp.ask(googleRichResponse);
      apiaiApp.ask(googleResponse); // Send response to Dialogflow and Google Assistant
   }
 }

 // Function to send correctly formatted responses to Dialogflow which are then sent to the user
 function sendResponse (responseToUser) {
   // if the response is a string send it as a response to the user
   if (typeof responseToUser === 'string') {
     let responseJson = {};
     responseJson.speech = responseToUser; // spoken response
     responseJson.displayText = responseToUser; // displayed response
     response.json(responseJson); // Send response to Dialogflow
   } else {
     // If the response to the user includes rich responses or contexts send them to Dialogflow
     let responseJson = {};

     // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
     responseJson.speech = responseToUser.speech || responseToUser.displayText;
     responseJson.displayText = responseToUser.displayText || responseToUser.speech;

     // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
     responseJson.data = responseToUser.richResponses;

     // Optional: add contexts (https://dialogflow.com/docs/contexts)
     responseJson.contextOut = responseToUser.outputContexts;

     response.json(responseJson); // Send response to Dialogflow
   }
 }

 //Access NorthWind
  function getInformation(){
    //action에 따른 처리
    request({
    	   url : sURL,
    	   method:'GET',
    	   json:true
     }, function(error, response, body){

     });
  }

 })
 // 요청 처리 끝

 app.listen(app.get('port'), function () {
   console.log('* Webhook service is listening on port:' + app.get('port'))
 })


//40. Client 별 rich response

// Construct rich response for Google Assistant
const apiaiApp = new DialogflowApp();
const googleRichResponse = apiaiApp.buildRichResponse()
 .addSimpleResponse('This is the first simple response for Google Assistant')
 .addSuggestions(
   ['Suggestion Chip', 'Another Suggestion Chip'])
   // Create a basic card and add it to the rich response
 .addBasicCard(apiaiApp.buildBasicCard(`This is a basic card.  Text in a
basic card can include "quotes" and most other unicode characters
including emoji 📱.  Basic cards also support some markdown
formatting like *emphasis* or _italics_, **strong** or __bold__,
and ***bold itallic*** or ___strong emphasis___ as well as other things
like line  \nbreaks`) // Note the two spaces before '\n' required for a
                       // line break to be rendered in the card
   .setSubtitle('This is a subtitle')
   .setTitle('Title: this is a title')
   .addButton('This is a button', 'https://assistant.google.com/')
   .setImage('https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
     'Image alternate text'))
 .addSimpleResponse({ speech: 'This is another simple response',
   displayText: 'This is the another simple response 💁' });

// Rich responses for both Slack and Facebook
const richResponses = {
 'slack': {
   'text': 'This is a text response for Slack.',
   'attachments': [
     {
       'title': 'Title: this is a title',
       'title_link': 'https://assistant.google.com/',
       'text': 'This is an attachment.  Text in attachments can include \'quotes\' and most other unicode characters including emoji 📱.  Attachments also upport line\nbreaks.',
       'image_url': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
       'fallback': 'This is a fallback.'
     }
   ]
 },
 'facebook': {
   'attachment': {
     'type': 'template',
     'payload': {
       'template_type': 'generic',
       'elements': [
         {
           'title': 'Title: this is a title',
           'image_url': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
           'subtitle': 'This is a subtitle',
           'default_action': {
             'type': 'web_url',
             'url': 'https://assistant.google.com/'
           },
           'buttons': [
             {
               'type': 'web_url',
               'url': 'https://assistant.google.com/',
               'title': 'This is a button'
             }
           ]
         }
       ]
     }
   }
 }
};
