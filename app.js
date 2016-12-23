var restify = require('restify');
var builder = require('botbuilder');
var http = require('http');
var url = require('url');

var wundergroundKey = process.env.WUNDERGROUND || "Missing wunderground API key";

var myAppId = process.env.MY_APP_ID || "Missing your app ID";
var myAppSecret = process.env.MY_APP_SECRET || "Missing your app secret";
var myWebUrl = process.env.MY_APP_URL || "http://localhost:3000";

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MY_APP_ID,
    appPassword: process.env.MY_APP_SECRET
});

var arrimg = {};

//Create bot and add dialogs
var bot = new builder.UniversalBot(connector);

var intents = new builder.IntentDialog();
bot.dialog('/', intents);

intents.matches(/^change/i, [
    function (session) {
        session.beginDialog('/weather');
    },
    function (session, results) {
    }
]);

intents.matches(/^end/i, [
    function (session) {
        if (session.userData.location) {
            session.send("Bye from %s", session.userData.location);
            session.endDialog();
            session.userData.location = null;
        } else {
            session.send("You are not in session");
        }
    },
    function (session, results) {
        
    }
]);

intents.matches(/^forecast/i, [
    function (session) {
        if (session.userData.location) {
            weather(session);
        } else {
            session.beginDialog('/weather');
        }
    },
    function (session, results) {
    }
]);

intents.matches(/^radar/i, [
    function (session) {
        if (session.userData.location) {
            weather_radar(session);
        } else {
            session.beginDialog('/weather');
        }
    },
    function (session, results) {
    }
]);

intents.onDefault([
    function (session, args, next) {
        if (!session.userData.location) {
            session.beginDialog('/weather');
        } else {
            builder.Prompts.choice(session, "Hello from city " + session.userData.location + "! \n\n" +
                "What you want to do now?"
                ,["change", "forecast", "radar map", "end dialog"], {listStyle: builder.ListStyle.button});
            next();
        }
    },
    function (session, results) {
        //session.send("### Hello from city %s", session.userData.location + "! \n\n" +
        //    "  if you want to see weather forecast enter **forecast** \n\n" +
        //    "  if you want to change city enter **change**");
    }
]);

bot.dialog('/weather', [
    function (session) {
        builder.Prompts.text(session, "Hello. I can tell you about any city " +
                "if you type it like **London, UK**.");
    },
    function (session, results) {
        session.userData.location = results.response;
        weather(session);
        session.endDialog();
    }
]);

function weather_radar(session) {
    try {   //Try to read in a string of "weather City, ST"
        var txt = session.userData.location;
        //convert "Weather" to "weather", then delete it
        txt = txt.toLowerCase();
        //split City, State by �,� and replace spaces with _ 
        var city = txt.split(',')[0].trim().replace(' ', '_');
        //assign state variable to the back half of the string 
        var state = txt.split(',')[1].trim();
        //log City, ST to the console for debugging 
        console.log(city + ', ' + state);
        //set user's global location to City, ST 
        session.userData.location = (city + ', ' + state.toUpperCase());

        var Stream = require('stream').Transform;

        session.send("Requesting city weather radar map ...");

        //Try to parse the City and State into a URL string
        var url = 'http://api.wunderground.com/api/' + wundergroundKey + '/animatedsatellite/q/state/city.gif?basemap=1&timelabel=1&timelabel.y=10&num=5&delay=50'
        url = url.replace('state', state);
        url = url.replace('city', city);
        console.log(url);

        //Need to have "var http = require('http');" up top, and "npm install --save http"
        http.get(
        {
            host: 'api.wunderground.com',
            path: url
        }, function (response, error) {
            //var data = new Stream();
            var bufs = [];
            response.on('data', function (d) { bufs.push(d); })
            response.on('end', function () {
                try {
                    if (!error && response.statusCode == 200) {
                        console.log("image ok");
                        //arrimg[state + city] = data;
                        session.send("radar map: \n\n"
                            + "![img]("+myWebUrl+"/img?id=" + state + city + ") ");

                        arrimg[state + city] = Buffer.concat(bufs); // Create a buffer from all the received chunks

                        //session.send("radar map: \n\n"
                        //    + "![img]("+url+") ");
                    } else {
                        console.log("image download error.");
                        session.send("Whoops, that didn't match! Try again.");
                        session.endDialog();
                        session.beginDialog('/weather');
                    }
                } //End of try 
                catch (e) {
                    console.log(e);
                    session.send("Whoops, that didn't match! Try again.");
                    session.endDialog();
                    session.beginDialog('/weather');
                }
            });
        }).end();

    } //End of try 
    catch (e)
    {
        session.send("Whoops, that didn't match! Try again.");
        session.endDialog();
        session.beginDialog('/weather');
    }

}

function weather(session) {
    try {   //Try to read in a string of "weather City, ST"
        var txt = session.userData.location;
        //convert "Weather" to "weather", then delete it
        txt = txt.toLowerCase();
        //split City, State by �,� and replace spaces with _ 
        var city = txt.split(',')[0].trim().replace(' ', '_');
        //assign state variable to the back half of the string 
        var state = txt.split(',')[1].trim();
        //log City, ST to the console for debugging 
        console.log(city + ', ' + state);
        //set user's global location to City, ST 
        session.userData.location = (city + ', ' + state.toUpperCase());

        session.send("Requesting city weather conditions ...");

        //Try to parse the City and State into a URL string
        var url = '/api/' + wundergroundKey + '/conditions/q/state/city.json'
        url = url.replace('state', state);
        url = url.replace('city', city);
        console.log('/.../' + state.toUpperCase() + '/' + city + '.json');

        //Need to have "var http = require('http');" up top, and "npm install --save http"
        http.get(
            {
                host: 'api.wunderground.com',
                path: url
            }, function (response) {
                var body = '';
                response.on('data', function (d) { body += d; })
                response.on('end', function () {
                    try {
                        var data = JSON.parse(body);
                        var conditions = data.current_observation.weather;
                        session.send(""
                            + "!["
                            + conditions + "]("
                            + data.current_observation.icon_url
                            + ") in **"
                            + city + "** right now, and the temperature is **"
                            + data.current_observation.temp_c + "** degrees C.   "
                            + data.current_observation.observation_time);
                    } //End of try 
                    catch (e) {
                        session.send("Whoops, that didn't match! Try again.");
                        session.endDialog();
                        session.beginDialog('/weather');
                    }
                });
            })
    } //End of try 
    catch (e)
    {
        session.send("Whoops, that didn't match! Try again.");
        session.endDialog();
        session.beginDialog('/weather');
    }

}

//Waterfall dialogs allow any results returned from the first function 
//to be passed as input to the next function.
//Waterfalls are created with [] surrounding an array of functions 
//in your call to bot.add(). 

//All messages received from the user and results returned from other dialogs 
//are processed when they call session.endDialog().
//Control will ONLY be returned back to the root dialog with a call to endDialog().

// Setup Restify Server for a bare-bones web service.
var server = restify.createServer();
server.get('/', restify.serveStatic({
    directory: __dirname,
    default: '/index.html'
}));

server.post('/api/messages', connector.listen());

server.get('/img', function (req, res) {
    console.log("### get image " + url.parse(req.url, true).query.id);
    //console.log("### arr len: " + arrimg[url.parse(req.url, true).query.id]);
    //res.writeHead(200, { 'Content-Type': 'image/gif' });
    res.end(arrimg[url.parse(req.url, true).query.id], 'binary');
})
server.listen(process.env.PORT || 3000, function () {
    console.log('%s __dirname to %s', server.name, __dirname);
    console.log('%s listening to %s', server.name, server.url);
});

