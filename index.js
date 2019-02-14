'use strict';
const mysql = require('mysql');
const axios = require('axios');
const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');
let app = express().use(bodyParser.json());
require('dotenv').config({ path: 'variables.env' });
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

let con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "on-time-rail"
});


// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));
// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {

    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {

            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);


            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }

        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "on-time-rail";
    // Your verify token. Should be a random string.
    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

function handleMessage(sender_psid, received_message) {

    let response;

    // Checks if the message contains text
    if (received_message.text) {
        switch(received_message.text.toLowerCase()) {
            case "hey" : response = {
                "text": "Hey!"
            }
                break;
            case "wat?" : response = {
                "text": `Hey! Ik ben On Time Rail. Je kan mij altijd vragen stellen in verband met je trein. Zo kan ik je laten weten of je trein vertraging heeft en misschien is afgeschaft. Verder help ik je ook met het plannen van je reis :)`
            }
                break;
            case "mango" : response = {
                "text": `Ge zijt er zelf ene joeng`
            }
                break;
            case "wijns" : response = {
                "text": `LOL :p Wie is dat nu weer`
            }
                break;
            case "willem" : response = {
                "text": `Dat is mijn echte vriend! Dankzij Willem ben ik ontstaan! :)`
            }
                break;
            case "andy" : response = {
                "text": `Dat is mijn echte vriend! Dankzij Andy ben ik ontstaan! :)`
            }
                break;
            default:response = {
                "text": `Sorry dat heb ik niet verstaan, probeer nog eens.`
            }
        }

        // Creates the payload for a basic text message, which
        // will be added to the body of our request to the Send API

    } else if (received_message.attachments) {
        // Get the URL of the message attachment
        let attachment_url = received_message.attachments[0].payload.url;
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Is this the right picture?",
                        "subtitle": "Tap a button to answer.",
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Yes!",
                                "payload": "yes",
                            },
                            {
                                "type": "postback",
                                "title": "No!",
                                "payload": "no",
                            }
                        ],
                    }]
                }
            }
        }
    }

    // Sends the response message
    callSendAPI(sender_psid, response);
}
function getConnections(sender_psid, cb) {
    var connections = [];
    con.query('SELECT * FROM connections WHERE psid = ' + sender_psid, function(err, stu){
        connections.push(stu);
        cb(connections); //callback if all queries are processed
    });
}


async function getTest(test, cb) {
    try {
        const response = await axios.get('http://api.irail.be/connections/?from=Mechelen&to=Puurs&date=010219&time=1650&timesel=departure&format=json&lang=en&fast=false&typeOfTransport=trains&alerts=false&resul1=1');
        cb(response.data.connection[0].departure.delay);
    } catch (error) {
        console.error(error);
    }
}
// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
    let response;

    // Get the payload for the postback
    let payload = received_postback.payload;

    // Set the response based on the postback payload
    switch(payload){
        case "yes" : response = {
            "text": "Thanks!"
        }
            break;
        case "no" : response = {
            "text": "No"
        }
            break;
        case "test" : response = {
            "text": "Ik test je!"
        }
            break;
        case "nieuw_trein" :
            break;
        case "check_trein" :

            getConnections(sender_psid,function(connections){
                console.log(connections[0][0].departure);
                
                
                let trains = [];
                for(let i = 0; i < connections[0].length; i++) {

                    let delay2 = getTest(connections[0][i].departure, function (delay) {
                        return delay;
                    })

                    console.log(delay2);

                    let userToken = AuthUser();
                    userToken.then(function(result) {
                        console.log(result) //will log results.
                    })

                    let item = {
                        "title": connections[0][i].departure + " - " + connections[0][i].destination,
                        "subtitle": 12,
                        "default_action": {
                            "type": "web_url",
                            "url": "https://www.belgiantrain.be/nl",
                            "webview_height_ratio": "tall",
                        },
                        "buttons":[
                            {
                                "type":"postback",
                                "title":"Bekijk trein 1",
                                "payload":"nieuw_trein"
                            }
                        ]
                    }
                    trains[i] = item;
                }
                console.log(trains);
                response = {
                    "attachment":{
                        "type":"template",
                        "payload":{
                            "template_type":"generic",
                            "elements":
                            trains

                        }
                    }
                }
                callSendAPI(sender_psid, response);
            });

            break;
    }

    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }



    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}