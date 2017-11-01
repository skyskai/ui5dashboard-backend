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
    //Category의 특정 Category의 사진을 Picutre에서 보여주도록 함
    'input.DetailCategory':() =>{
      let forUIresults = {"Action":"input.DetailCategory","Parameters":{"CategoryName":parameters['CategoryName']}};
      responseJson.forUIresults = JSON.stringify(forUIresults);
      responseJson.forUIRequest = requestOriginal;
      responseJson.speech = "Ok, I have sent the picture of " + parameters['CategoryName'] + ' to your screen';
      responseJson.displayText = responseJson.speech;
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse(responseJson);
      } else {
        sendResponse(responseJson);
      }
    },
    //SalesCategory(Country, Category, Product)와 년도 기준 Sales
    'input.SalesCategory_Year':() =>{
      let aResult;
      let iYear = parameters['Year'].substring(0,4) * 1;
      let forUIresults = {"Action":"input.SalesCategory_Year","Parameters":{"Year":iYear,"SalesCategory":parameters['SalesCategory']}};
      //조건에 해당하는 값을 읽어오기
      switch (parameters['SalesCategory']) {
        case 'Country':
          aResult = getDataByYear(aSales.SalesByCountry,iYear)
          break;
        case 'Category':
          aResult = getDataByYear(aSales.SalesByCategory,iYear)
          break;
        case 'Product':
          aResult = getDataByYear(aSales.SalesByProduct,iYear)
          break;
        default:
      }
      responseJson.forUIresults = JSON.stringify(forUIresults);
      responseJson.forUIRequest = requestOriginal;

      if (requestSource === googleAssistantRequest) {
        aResult.sort(customSort);
        switch (parameters['SalesCategory']) {
          case 'Country':
            responseJson.speech = 'In ' + iYear + ',' + aResult[0].Country + ',' + aResult[1].Country + ', and ' + aResult[2].Country +
                                  ' are the top three countries in sales';
            responseJson.displayText = responseJson.speech; // displayed response

            break;
          case 'Category':
            responseJson.speech = 'In ' + iYear + ',' + aResult[0].Category + ',' + aResult[1].Category + ' and ' + aResult[2].Category +
                                  ' are the top three categories in sales';
             responseJson.displayText = responseJson.speech; // displayed response
            break;
          case 'Product':
             responseJson.speech = 'In ' + iYear + ',' + aResult[0].Product + ',' + aResult[1].Product + ' and ' + aResult[2].Product +
                                   ' are the top three products in sales';
             responseJson.displayText = responseJson.speech; // displayed response
            break;
          default:
        }
        sendGoogleResponse(responseJson); // Send simple response to user
      } else {
        // responseJson.speech = 'Year is '+ parameters['Year'] + 'Sales Category is '+ parameters['SalesCategory'] ; // spoken response
        // responseJson.displayText = responseJson.speech; // displayed response
        responseJson.speech = JSON.stringify(aResult);
        responseJson.displayText = responseJson.speech;
        sendResponse(responseJson);
      }

    },
    //Country, Category, Product의 담당자 정보
    'input.Manager':() => {
      let aResult;
      let sCountryName = parameters['CountryName'];
      let sCategoryName = parameters['CategoryName'];
      let sProductName = parameters['ProductName'];
      let forUIresults = {"Action":"input.Manager","Parameters":{"CountryName":sCountryName,"CategoryName":sCategoryName,"ProductName":sProductName}};
      responseJson.forUIresults = JSON.stringify(forUIresults);
      responseJson.forUIRequest = requestOriginal;
      responseJson.speech = 'The manager is ' + 'Charles a senior consultant of SAMSUNG SDS.';
      responseJson.displayText = responseJson.speech;
        if (requestSource === googleAssistantRequest) {
          sendGoogleResponse(responseJson); // Send simple response to user
        } else {
          sendResponse(responseJson);
        }

   },
   //담당 메니져에게 메일 보냄
   'input.sendMailToManager':() => {
     let aResult;
     let iYear = parameters['Year'].substring(0,4) * 1;
     let forUIresults = {"Action":"input.sendMailToManager","Parameters":{"Year":iYear,"SalesCategory":parameters['SalesCategory']}};
     //조건에 해당하는 값을 읽어오기
     switch (parameters['SalesCategory']) {
       case 'Country':
         aResult = getDataByYear(aSales.SalesByCountry,iYear)
         break;
       case 'Category':
         aResult = getDataByYear(aSales.SalesByCategory,iYear)
         break;
       case 'Product':
         aResult = getDataByYear(aSales.SalesByProduct,iYear)
         break;
       default:
     }
     responseJson.forUIresults = JSON.stringify(forUIresults);
     responseJson.forUIRequest = requestOriginal;
     responseJson.speech = 'Email sent to the manager';
     responseJson.displayText = responseJson.speech;
     if (requestSource === googleAssistantRequest) {
       aResult.sort(customSort);
       sendListToManger(aResult,['skyskai@naver.com','s.chul.yang@samsung.com'],parameters['SalesCategory']);
       sendGoogleResponse(responseJson); // Sen
     } else {
       aResult.sort(customSort);
       sendListToManger(aResult,['skyskai@naver.com','s.chul.yang@samsung.com'],parameters['SalesCategory']);
       sendResponse(responseJson);
     }
   },
   //두개 년도를 비교
   'input.CountryCompare':() =>{
     let aResult;
     let aYearBetween = parameters['Year_Between'].split('-');

     let iYearFrom = aYearBetween[0] * 1;
     let iYearTo = aYearBetween[2].split('/')[1] * 1;
     let sCountryName = parameters['CountryName'];
     let forUIresults = {"Action":"input.CountryCompare","Parameters":{"YearFrom":iYearFrom,"YearTo":iYearTo,"CountryName":sCountryName}};

     //비교할 값을 읽어서 각각 oResultFrom, oResultTo에 넣음.
     const fnFilterCountry = function(aList,sCountryName){
                        let oFound = aList.filter(function(obj){
                        if(obj.Country === sCountryName){
                  		      return obj;	}})

                       return oFound;
                     };

    //Amount를 비교해서 결과를 리턴함
    responseJson.forUIresults = JSON.stringify(forUIresults);
    responseJson.forUIRequest = requestOriginal;
    //전체 국가를 선택할 경우
    if(sCountryName==='ALL'){
      // let oResultFrom = getDataByYear(aSales.SalesByCountry,iYearFrom);
      // let oResultTo = getDataByYear(aSales.SalesByCountry,iYearTo);
      responseJson.speech = 'Here are the sales for all the countries between '+ iYearFrom + ' and ' + iYearTo;
     responseJson.displayText = responseJson.speech;
    } else {
      let oResultFrom = fnFilterCountry(getDataByYear(aSales.SalesByCountry,iYearFrom),sCountryName)[0];
      let oResultTo = fnFilterCountry(getDataByYear(aSales.SalesByCountry,iYearTo),sCountryName)[0];
      let iGapTo_From = ( oResultTo.Amount - oResultFrom.Amount ).toFixed(2);
      const sResultPre = 'In ' + oResultTo.Year + ' the sales of ' + oResultTo.Country + ' has ';
      if(iGapTo_From < 0){//감소
        responseJson.speech = sResultPre + ' decreased about $'+ iGapTo_From * -1 + ' compared to in '+oResultFrom.Year;
      } else  {
        responseJson.speech = sResultPre + ' increased about $'+ iGapTo_From + ' compared to in '+oResultFrom.Year;
      }
       responseJson.displayText = responseJson.speech;
    }
     sendResponse(responseJson);

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
 //Websocket 서버에 전달
 sendResponseToWebsocket(responseJson);

 //리스트를 담당자에게 email보냄
 function sendListToManger(aList,aRecipient,sSalesCategory){
   var sHeader = "";
   var sBodyTemplate="";
   var transporter = nodemailer.createTransport({
					  service: 'gmail',
					  auth: {
						type: 'OAuth2',
						user: 'skyskai@gmail.com',
						clientId: '697108665452-vm4pivn0s76ftdliiiohjihap1ppk0l3.apps.googleusercontent.com',
						clientSecret: 'm_6wflsOFLHz_bzXDc_bbpWK',
						refreshToken: '1/s5UePzl9fvAU7sJra8rP-9Wb0v2DuXt5fe--4emt8kU',
						accessToken: 'ya29.GlvhBDi1s75uvVJRvNGE26GDh6_C9DOm3dasQxLgYtPObTXW4hGT_H7oJLnITNIWW7ImuOHceXWzjQDF0fVxeQNs2GrQV0aSknjUelFxavrcIohJMgl_anHBeSqs',
						expires: 3600
					  }
					});

          //json to html
          switch (sSalesCategory) {
            case 'Country':
            sHeader = '<div class="container"><p><table cellspacing="2" cellpadding="0" border="0" align="center" bgcolor="#999999"><thead><tr>' +
                         '<th>Year</th>'+'<th>Country</th>'+'<th>Amount</th>'+'<th>Currency</th>'+'</tr></thead>'; //
            sBodyTemplate = {
               															tag: 'tr',
               															bgcolor :"#ffffff",
               															children: [{
               																  "tag": "td",
               																  "html": "${Year}"
               																},
               																{
               																  "tag": "td",
               																  "html": "${Country}"
               																},
               																{
               																  "tag": "td",
               																  "html": "${Amount}"
               																},
               																{
               																  "tag": "td",
               																  "html": "${Currency}"
               																}]};
              break;
              case 'Category':
               sHeader = '<div class="container"><p><table cellspacing="2" cellpadding="0" border="0" align="center" bgcolor="#999999"><thead><tr>' +
                          '<th>Year</th>'+'<th>Category</th>'+'<th>Amount</th>'+'<th>Currency</th>'+'</tr></thead>'; //
              sBodyTemplate = {
                             															tag: 'tr',
                             															bgcolor :"#ffffff",
                             															children: [{
                             																  "tag": "td",
                             																  "html": "${Year}"
                             																},
                             																{
                             																  "tag": "td",
                             																  "html": "${Category}"
                             																},
                             																{
                             																  "tag": "td",
                             																  "html": "${Amount}"
                             																},
                             																{
                             																  "tag": "td",
                             																  "html": "${Currency}"
                             																}]};

                break;
                case 'Product':
                 sHeader = '<div class="container"><p><table cellspacing="2" cellpadding="0" border="0" align="center" bgcolor="#999999"><thead><tr>' +
                            '<th>Year</th>'+'<th>Product</th>'+'<th>Amount</th>'+'<th>Currency</th>'+'</tr></thead>'; //
                 sBodyTemplate = {
                                                            tag: 'tr',
                                                            bgcolor :"#ffffff",
                                                            children: [{
                                                                "tag": "td",
                                                                "html": "${Year}"
                                                              },
                                                              {
                                                                "tag": "td",
                                                                "html": "${Product}"
                                                              },
                                                              {
                                                                "tag": "td",
                                                                "html": "${Amount}"
                                                              },
                                                              {
                                                                "tag": "td",
                                                                "html": "${Currency}"
                                                              }]};
                  break;
            default:

          }


					var sBody = json2html.transform(aList,sBodyTemplate);

          var mailOptions = {
      					  from: 'skyskai@gmail.com',
      					  to:  aRecipient.toString(), //'skyskai@naver.com,s.chul.yang@samsung.com',
                  subject : '[AIDeviceTest] 매출 현황 확인 바랍니다',
                  html: sHeader+sBody+'<tbody></tbody>        </table></div>'
					};
          transporter.sendMail(mailOptions, function(error, info){
  					  if (error) {
  						console.log(error);
  					  } else {
  						console.log('Email sent: ' + info.response);
  					  }
  					});
 }
 //금액 기준 역순 소팅
 function customSort(a, b) {
     if(a.Amount == b.Amount){ return 0} return  a.Amount < b.Amount ? 1 : -1;
   }
 //Websocket 서버에 전달
 function sendResponseToWebsocket(responseToUser){
    process.stdin.resume();
		process.stdin.setEncoding('utf8');
   ws.send(JSON.stringify(responseToUser));//, console.log.bind(null, 'Sent : ', JSON.stringify(responseToUser)));

	process.stdin.on('data', function(message) {
	  message = message.trim();
	  ws.send(message);//, console.log.bind(null, 'Sent : ', message));
	});

	ws.on('message', function(message) {
	  console.log('Received: ' + message);
	});

	ws.on('close', function(code) {
	  console.log('Disconnected: ' + code);
	});

	ws.on('error', function(error) {
	  console.log('Error: ' + error.code);
	});
 }
//Country, Category, Product의 년도별 Sales
 function getDataByYear(aSales,iYear){
 	let oFound = aSales.filter(function(obj){
             	if(obj.Year === iYear){
             		return obj;	}})
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
