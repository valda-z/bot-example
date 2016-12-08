var restify = require('restify');
var builder = require('botbuilder');
var Wunderground = require('wundergroundnode');
var http = require('http');

var wundergroundKey = process.env.WUNDERGROUND || "Missing wunderground API key";
var wunderground = new Wunderground(wundergroundKey);

var myAppId = process.env.MY_APP_ID || "Missing your app ID";
var myAppSecret = process.env.MY_APP_SECRET || "Missing your app secret";

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MY_APP_ID,
    appPassword: process.env.MY_APP_SECRET
});

//Create bot and add dialogs
var bot = new builder.UniversalBot(connector);

bot.dialog('/', new builder.IntentDialog()    
.matches('/^weather/i',  [function (session) {
    session.beginDialog('/weather');
    }])
    // The IntentDialog lets you add a RegEx that, when matched, 
    //will invoke a Dialog Handler.
.onDefault([
    //The first step of the root ‘/’ dialog checks to see if we know 
    //the user's location, and if not, it redirects them to the ‘/weather’ dialog
    //using a call to beginDialog(). 
    function (session, args, next) 
    {
        if (!session.userData.location) { session.beginDialog('/weather'); }
        else { next(); }    
            //You can persist data for a user globally by assigning values 
            //to the session.userData object, like we've done here for location.
    },
    function (session, results) 
    {
        if (session.userData.location != null) {
            session.send('Hello from %s', session.userData.location + "!");
        }
    }
]));

bot.dialog('/weather', [
    function (session, args, next) 
    {
        if (session.userData.location) 
        { builder.Prompts.text(session, "Is that a new city? Hang on, let me go check..."); } 
        else 
        {
            builder.Prompts.text(session, "Hello. I can tell you about any city " +
            "if you type it like 'weather London, UK'.");
        }
        //check to see if user is requesting a new location.
        if (session.userData.location) { next(); }
    },
    function (session, results)     //WeatherUnderground API 
    {
        try 
        {   //Try to read in a string of "weather City, ST"
            var txt = session.message.text;
            //convert "Weather" to "weather", then delete it
            txt = txt.toLowerCase().replace('weather ', '');
            //split City, State by ‘,’ and replace spaces with _ 
            var city = txt.split(',')[0].trim().replace(' ', '_');
            //assign state variable to the back half of the string 
            var state = txt.split(',')[1].trim();
            //log City, ST to the console for debugging 
            console.log(city + ', ' + state);
            //set user's global location to City, ST 
            session.userData.location = (city + ', ' + state.toUpperCase());

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
                        var data = JSON.parse(body);
                        var conditions = data.current_observation.weather;
                        session.send("'" + conditions + "' in "
                            + city + " right now, and the temperature is "
                            + data.current_observation.temp_f + " degrees F.   "
                            + data.current_observation.observation_time);
                    });
                })
        } //End of try 
        catch (e) 
        { session.send("Whoops, that didn't match! Try again."); }
        session.endDialog();
    } //End of WeatherUnderground API function 
]); //End of ‘/weather’ dialog waterfall 

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
server.get('/img.svg', restify.serveStatic({
    directory: __dirname,
    default: '/img.svg'
}));
server.post('/api/messages', connector.listen());
server.listen(process.env.PORT || 3000, function () {
    console.log('%s __dirname to %s', server.name, __dirname);
    console.log('%s listening to %s', server.name, server.url);
});

