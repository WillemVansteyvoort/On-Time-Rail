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

async function handleMessage(sender_psid, received_message) {

    let response;

    if (received_message.text) {
        //checken of treineke wordt aangemaakt
        await con.query('SELECT * FROM connections WHERE psid = ' + sender_psid + ' ORDER BY id DESC LIMIT 1', async function (err, stu) {
            try {
                if (stu.length > 0 && !stu[0].departure) {
                    if (received_message.text.toLowerCase() === "stop") {
                        con.query('DELETE FROM connections', function (err) {
                            callSendAPI(sender_psid, {"text": "Ik heb je nieuwe trein succesvol aanvraag geannuleerd :)"})
                        });
                    } else {
                        updateDeparture(sender_psid, received_message.text);
                    }
                } else if (stu.length > 0 && !stu[0].destination) {
                    if (received_message.text.toLowerCase() === "stop") {
                        con.query('DELETE FROM connections', function (err) {
                            callSendAPI(sender_psid, {"text": "Ik heb je nieuwe trein succesvol aanvraag geannuleerd :)"})
                        });
                    } else {
                        updateDestination(sender_psid, stu[0].departure, received_message.text);
                    }
                } else {
                    switch (received_message.text.toLowerCase()) {
                        case "hey" :
                            response = {
                                "text": "Hey!",
                            }
                            break;
                        case "wat?" :
                            response = {
                                "text": `Hey! Ik ben On Time Rail. Je kan mij altijd vragen stellen in verband met je trein. Zo kan ik je laten weten of je trein vertraging heeft en misschien is afgeschaft. Verder help ik je ook met het plannen van je reis :)`
                            }
                            break;
                        case "mango" :
                            response = {
                                "text": `Ge zijt er zelf ene joeng`
                            }
                            break;
                        case "wijns" :
                            response = {
                                "text": `LOL :p Wie is dat nu weer`
                            }
                            break;
                        case "willem" :
                            response = {
                                "text": `Dat is mijn echte vriend! Dankzij Willem ben ik ontstaan! :)`
                            }
                            break;
                        case "andy" :
                            response = {
                                "text": `Dat is mijn echte vriend! Dankzij Andy ben ik ontstaan! :)`
                            }
                            break;
                        case "help" :
                            response = {
                                "text": `
                                Heeft u vragen? Geen probleem! 
                                \n - U kan een nieuwe trein toevoegen via het menu onderaan
                                \n - U kan de status van uw treinen bekijken via het menu onderaan
                                \n - Als u de details van een bepaalde trein wilt bekijken klikt u op "bekijk trein"
                                \n ... De rest komt later! ;)
                                \n `
                            }
                            break;
                        default:
                            response = {
                                "text": `Sorry dat heb ik niet verstaan, probeer nog eens.`
                            }
                    }
                    callSendAPI(sender_psid, response);
                }
            } catch {
            }

        });
    }
}
const newConnection = async (sender_psid, departure) => {
    con.query('INSERT INTO connections(psid) VALUES (' + sender_psid + ")", function(err){
    });
};

const updateDeparture = async (sender_psid, departure) => {
    let contains = false;

    const query = await axios.get('http://api.irail.be//stations/?format=json&lang=nl');
    for (let i = 0 ; i < query.data.station.length; i++){
        if (query.data.station[i].name.toLowerCase() === departure.toLowerCase()){
            contains = true;
        }
    } 

    if(contains) {
        con.query('UPDATE connections SET departure = "' + departure + '" WHERE psid = ' + sender_psid + ' ORDER BY id DESC LIMIT 1', function (err) {
        });
        callSendAPI(sender_psid,  {"text": "Wat is uw aankomstplaats? (Zeg stop om te beëindigen)"});
    }else{
        callSendAPI(sender_psid, {"text": "Sorry maar ik kan het station " + departure + " niet vinden :( (Zeg stop om te beëindigen)"});
    }
};

const updateDestination = async (sender_psid, departure, destination) => {
    let contains = false;

    const query = await axios.get('http://api.irail.be//stations/?format=json&lang=nl');
    for (let i = 0 ; i < query.data.station.length; i++){
        if (query.data.station[i].name.toLowerCase() === destination.toLowerCase()){
            contains = true;
        }
    }

    if(contains) {
        con.query('UPDATE connections SET destination = "' + destination + '" WHERE psid = ' + sender_psid + ' ORDER BY id DESC LIMIT 1', function (err) {
        });
        callSendAPI(sender_psid, {"text": "Uw trein van " + departure + " naar " + destination + " is aangemaakt :)"});
    }else{
        callSendAPI(sender_psid, {"text": "Sorry maar ik kan het station " + destination + " niet vinden :( (Zeg stop om te beëindigen)"});
    }
};

const getConnection = async (sender_psid, trajectid) => {
    var connections = [];
    con.query('SELECT * FROM connections WHERE psid = ' + sender_psid, function(err, stu){
        connections.push(stu);
    });
};

const getConnections = async (sender_psid, cb) => {
    var connections = [];
    con.query('SELECT * FROM connections WHERE psid = ' + sender_psid, function(err, stu){
        connections.push(stu);
        cb(connections); //callback if all queries are processed
    });
};



const handlePostback = async (sender_psid, received_postback) => {
    await con.query('SELECT * FROM connections WHERE psid = ' + sender_psid + ' ORDER BY id DESC LIMIT 1', async function (err, stu) {
        try {
            if(stu.length > 0) {
                if (stu[0].departure === null || stu[0].destination === null) {
                    callSendAPI(sender_psid, {"text": "zou je eerst je trein willen aanmaken?  >.<"});
                } else {
                    postbacks(sender_psid, received_postback);
                }
            } else {
                postbacks(sender_psid, received_postback);
            }
        } catch {
        }

    });
}


async function  postbacks(sender_psid, received_postback) {
    if (received_postback.payload.substr(0, 5) === "trein") {
        let id = received_postback.payload.replace("trein ", "");
        await con.query('SELECT * FROM connections WHERE psid = ' + sender_psid + ' AND id = ' + id + ' ORDER BY id DESC LIMIT 1', async function (err, stu) {
            let time = new Date();
            let month = "";
            let day = "";

            if (time.getDate() < 10) {
                day += "0" + time.getDate();
            } else {
                day += time.getDate();
            }

            if ((time.getMonth() + 1) < 10) {
                month += "0" + (time.getMonth() + 1);
            } else {
                month += (time.getMonth() + 1);
            }
            const query = await axios.get('http://api.irail.be/connections/?from=' + stu[0].departure + '&to=' + stu[0].destination + '&date=' + day + month + '19&timesel=departure&format=json&lang=nl&fast=true&typeOfTransport=trains&alerts=false&resul1=1');
            var departureDate = new Date(query.data.connection[0].departure.time * 1000);
            var arrivalDate = new Date(query.data.connection[0].arrival.time * 1000);
            let response = {
                "text": query.data.connection[0].departure.station + " - " + query.data.connection[0].arrival.station + " (" + departureDate.getHours() + "u" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) + ")" +
                    "\n Voertuig: " + query.data.connection[0].departure.vehicle +
                    "\n Vertrek: " + departureDate.getHours() + ":" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) +
                    "\n Spoor Vertrek: " + query.data.connection[0].departure.platform +
                    "\n Aankomst: " + arrivalDate.getHours() + ":" + (arrivalDate.getMinutes() < 10 ? "0" + arrivalDate.getMinutes() : arrivalDate.getMinutes()) +
                    "\n Spoor Aankomst: " + query.data.connection[0].arrival.platform + "" +
                    "\n ",
            };
            callSendAPI(sender_psid, response);

            console.log(query.data.connection[0].vias );
            if (query.data.connection[0].vias !== undefined && query.data.connection[0].vias.number > 0) {
                for (let f = 0; f < query.data.connection[0].vias.number; f++) {
                    departureDate = new Date(query.data.connection[0].vias.via[f].departure.time * 1000);
                    arrivalDate = new Date(query.data.connection[0].vias.via[f].arrival.time * 1000);
                    await callSendAPI(sender_psid, {
                        "text": "Via " + query.data.connection[0].vias.via[f].station + " (" + departureDate.getHours() + "u" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) + ")" +
                            "\n Aankomst: " + arrivalDate.getHours() + ":" + (arrivalDate.getMinutes() < 10 ? "0" + arrivalDate.getMinutes() : arrivalDate.getMinutes()) +
                            "\n Spoor Aankomst: " + query.data.connection[0].arrival.platform + "" +
                            "\n Vertrek: " + departureDate.getHours() + ":" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) + //JA JOE KAPOT GEMAAKT MISSCH NIMEER
                            "\n Spoor Vertrek: " + query.data.connection[0].departure.platform +
                            "\n ",
                    });
                }
            }
            console.log(query.data.connection[0].departure);
            console.log(query.data.connection[0].arrival);
        });
    }else if (received_postback.payload.substr(0, 7) === "treinen") {
        let id = received_postback.payload.replace("treinen ", "");
        let iddb =  id.split(" ")[0];
        let iterator = id.split(" ")[1];
        console.log("iddb = " + iddb + "iterator = " + iterator);
        await con.query('SELECT * FROM connections WHERE psid = ' + sender_psid + ' AND id = ' + id + ' ORDER BY id DESC LIMIT 1', async function (err, stu) {
            let time = new Date();
            let month = "";
            let day = "";

            if (time.getDate() < 10) {
                day += "0" + time.getDate();
            } else {
                day += time.getDate();
            }

            if ((time.getMonth() + 1) < 10) {
                month += "0" + (time.getMonth() + 1);
            } else {
                month += (time.getMonth() + 1);
            }
            const query = await axios.get('http://api.irail.be/connections/?from=' + stu[0].departure + '&to=' + stu[0].destination + '&date=' + day + month + '19&timesel=departure&format=json&lang=nl&fast=true&typeOfTransport=trains&alerts=false&resul1=1');
            var departureDate = new Date(query.data.connection[0].departure.time * 1000);
            var arrivalDate = new Date(query.data.connection[0].arrival.time * 1000);
            let response = {
                "text": query.data.connection[0].departure.station + " - " + query.data.connection[0].arrival.station + " (" + departureDate.getHours() + "u" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) + ")" +
                    "\n Voertuig: " + query.data.connection[0].departure.vehicle +
                    "\n Vertrek: " + departureDate.getHours() + ":" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) +
                    "\n Spoor Vertrek: " + query.data.connection[0].departure.platform +
                    "\n Aankomst: " + arrivalDate.getHours() + ":" + (arrivalDate.getMinutes() < 10 ? "0" + arrivalDate.getMinutes() : arrivalDate.getMinutes()) +
                    "\n Spoor Aankomst: " + query.data.connection[0].arrival.platform + "" +
                    "\n ",
            };
            callSendAPI(sender_psid, response);

            if(query.data.connection[0].vias.number > 0) {
                for (let f  = 0; f < query.data.connection[0].vias.number; f++) {
                    departureDate = new Date(query.data.connection[0].vias.via[f].departure.time * 1000);
                    arrivalDate = new Date(query.data.connection[0].vias.via[f].arrival.time * 1000);
                    await callSendAPI(sender_psid, {
                        "text": "Via " + query.data.connection[0].vias.via[f].station + " (" + departureDate.getHours() + "u" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) + ")" +
                            "\n Aankomst: " + arrivalDate.getHours() + ":" + (arrivalDate.getMinutes() < 10 ? "0" + arrivalDate.getMinutes() : arrivalDate.getMinutes()) +
                            "\n Spoor Aankomst: " + query.data.connection[0].arrival.platform + "" +
                            "\n Vertrek: " + departureDate.getHours() + ":" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) + //JA JOE KAPOT GEMAAKT MISSCH NIMEER
                            "\n Spoor Vertrek: " + query.data.connection[0].departure.platform +
                            "\n ",
                    });
                }
            }
            console.log(query.data.connection[0].departure);
            console.log(query.data.connection[0].arrival);
        });
    } else if (received_postback.payload.substr(0, 5) === "later") {
        let id = received_postback.payload.replace("later ", "");
        await con.query('SELECT * FROM connections WHERE psid = ' + sender_psid + ' AND id = ' + id + ' ORDER BY id DESC LIMIT 1', async function (err, stu) {
            let time = new Date();
            let month = "";
            let day = "";

            if (time.getDate() < 10) {
                day += "0" + time.getDate();
            } else {
                day += time.getDate();
            }

            if ((time.getMonth() + 1) < 10) {
                month += "0" + (time.getMonth() + 1);
            } else {
                month += (time.getMonth() + 1);
            }
            const query = await axios.get('http://api.irail.be/connections/?from=' + stu[0].departure + '&to=' + stu[0].destination + '&date=' + day + month + '19&timesel=departure&format=json&lang=nl&fast=true&typeOfTransport=trains&alerts=false&resul1=10');
            var connections = query.data.connection;

            let items = [];
            for (let i = 1; i < (connections.length > 10? 10: connections.length); i++) {
                let delay = " ";
                if (connections[i].departure.canceled === 1) {
                    delay = "Je trein is geannuleerd";
                } else if (connections[i].departure.delay > 0) {
                    delay = (connections[i].departure.delay / 60) + " minuten vertraging";
                } else {
                    delay = "Geen vertraging";
                }

                var departureDate = new Date(connections[i].departure.time * 1000);
                items[i - 1] = {
                    "title": connections[i].departure.station + " - " + connections[i].arrival.station + " (" + departureDate.getHours() + "u" + (departureDate.getMinutes() < 10 ? "0" + departureDate.getMinutes() : departureDate.getMinutes()) + ")",
                    "subtitle": delay,
                    "default_action": {
                        "type": "web_url",
                        "url": connections[i].departure.departureConnection,
                        "webview_height_ratio": "tall",
                    },
                    "buttons": [
                        {
                            "type": "postback",
                            "title": "Bekijk dit traject",
                            "payload": "treinen " + i + " " + stu[0].id
                        }
                    ]
                }
            }
            let response = {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "generic",
                        "elements":
                        items

                    }
                }
            }
            callSendAPI(sender_psid, response);

        });
    } else if (received_postback.payload.substr(0, 9) === "verwijder") {
        let id = received_postback.payload.replace("verwijder ", "");
        await con.query('DELETE FROM connections WHERE id = ' + id, async function (err, stu) {
            if (!err) {
                callSendAPI(sender_psid, {"text": `Ik heb je trein succesvol verwijdert uit je lijst :)`});
            } else {
                callSendAPI(sender_psid, {"text": `Er is een probleem opgelopen tijdens het verwijderen van je trein :(`});
            }
        });
    } else {
        switch (received_postback.payload) {
            case 'check_trein':
                getConnections(sender_psid, async function (connections) {
                    try {
                        let response;
                        if (connections[0].length === 0) {
                            callSendAPI(sender_psid, {"text": `Het lijkt dat je nog geen treinen hebt opgeslagen, voeg er eerst een toe`});
                        } else {
                            let items = [];
                            for (let i = 0; i < connections[0].length; i++) {
                                let time = new Date();
                                let month = "";
                                let day = "";

                                if (time.getDate() < 10) {
                                    day += "0" + time.getDate();
                                } else {
                                    day += time.getDate();
                                }

                                if ((time.getMonth() + 1) < 10) {
                                    month += "0" + (time.getMonth() + 1);
                                } else {
                                    month += (time.getMonth() + 1);
                                }

                                const query = await axios.get('http://api.irail.be/connections/?from=' + connections[0][i].departure + '&to=' + connections[0][i].destination + '&date=' + day + month + '19&timesel=departure&format=json&lang=nl&fast=true&typeOfTransport=trains&alerts=false&resul1=1');
                                let delay = " ";
                                console.log("MANGO + " + query.data.connection[0].departure.canceled);
                                if (query.data.connection[0].departure.canceled === "1") {
                                    console.log("MANGO0 + " + query.data.connection[0].departure.canceled);
                                    delay = "Je trein is geannuleerd";
                                } else if (query.data.connection[0].departure.delay > 0) {
                                    delay = (query.data.connection[0].departure.delay / 60) + " minuten vertraging";
                                } else{
                                    delay = "Geen vertraging";
                                }

                                var departureDate = new Date(query.data.connection[0].departure.time * 1000);
                                items[i] = {
                                    "title": query.data.connection[0].departure.station + " - " + query.data.connection[0].arrival.station + " (" + departureDate.getHours() + "u" + departureDate.getMinutes() + ")",
                                    "subtitle": delay,
                                    "default_action": {
                                        "type": "web_url",
                                        "url": query.data.connection[0].departure.departureConnection,
                                        "webview_height_ratio": "tall",
                                    },
                                    "buttons": [
                                        {
                                            "type": "postback",
                                            "title": "Bekijk dit traject",
                                            "payload": "trein " + connections[0][i].id
                                        },
                                        {
                                            "type": "postback",
                                            "title": "Bekijk later",
                                            "payload": "later " + connections[0][i].id
                                        },
                                        {
                                            "type": "postback",
                                            "title": "Verwijder deze trein",
                                            "payload": "verwijder " + connections[0][i].id
                                        }
                                    ]
                                }
                            }
                            response = {
                                "attachment": {
                                    "type": "template",
                                    "payload": {
                                        "template_type": "generic",
                                        "elements":
                                        items

                                    }
                                }
                            }
                        }
                        callSendAPI(sender_psid, response);
                    } catch {
                    }
                });
                break;
            case 'nieuw_trein' :
                newConnection(sender_psid);
                callSendAPI(sender_psid, {"text": `Wat is uw vertrekplaats?`});
                break;
            case 'welcome' :
                callSendAPI(sender_psid, {"text": `Hallo! Ik ben On-Time-Rail. Ik zorg ervoor dat u in alle gevallen de status van uw treinen kunt bekijken. :) Typ "help" als u problemen heeft.`});
                break;
            //information about new train
            default:
                callSendAPI(sender_psid, {"text": `Wat is uw vertrekplaats?`});
        }
    }
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