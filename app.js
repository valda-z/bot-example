var restify = require('restify');
var builder = require('botbuilder');
var Wunderground = require('wundergroundnode'); //is this redundant? 
var http = require('http');

//var https = require('https');
//var Weather  = require('openweathermap'); 
//var weatherKey = process.env.WEATHER_KEY || "Missing weather API key"; 

var wundergroundKey = process.env.WUNDERGROUND || "Missing wunderground API key";
var wunderground = new Wunderground(wundergroundKey);
    //is this redundant? 

var myAppId = process.env.MY_APP_ID || "Missing your app ID";
var myAppSecret = process.env.MY_APP_SECRET || "Missing your app secret";

////Hello World code
// var bot = new builder.BotConnectorBot({appId: myAppId, appSecret: myAppSecret });
// bot.add('/', new builder.SimpleDialog(function(session){session.send('Hello World'); })); 

//Create bot and add dialogs
var bot = new builder.BotConnectorBot({ appId: myAppId, appSecret: myAppSecret });
        // created a new BotConnetcorBot (as opposed to a TextBot).

bot.add('/', new builder.CommandDialog()    
        //root ‘/’ dialog responds to any message.
.matches('^weather', builder.DialogAction.beginDialog('/weather'))
        // The CommandDialog lets you add a RegEx that, when matched, 
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
        session.send('Hello from %s', session.userData.location + "!");
    }
])); //End of bot.add() root ‘/’ dialog and .onDefault();

bot.add('/weather', [
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
        {           //Try to read in a string of "weather City, ST"
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

//Need "var wundergroundKey = 'your Wunderground API key here';" up top,
//and "npm install --save wundergroundnode"

                    //Try to parse the City and State into a URL string
            var url = '/api/' + wundergroundKey + '/conditions/q/state/city.json'
            url = url.replace('state', state);
            url = url.replace('city', city);
                    //log "/.../ST/City.json" to the console for debugging 
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
                }) //https://lostechies.com/andrewsiemer/2016/04/14/building-a-slack-bot-with-botkit-node-and-docker/
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


//example of OpenWeatherMap code:
// exports.weather = function(cb) 
// {
//   if (this.message.names) 
//   {
//     var location = this.message.names[0]
//     https.get("https://api.openweathermap.org/data/2.5/find?q=" + location + "&units=imperial" + "&lang=en" + "&mode=json", function(res)
// 	{
// 		console.log('statusCode: ', res.statusCode);
// 		console.log('headers: ', res.headers);
// 		res.on('data', function (d) {
// 			process.stdout.write(d);
// 		});
// 	}).on('error', function (e) {
// 		console.error(e);
// 	});  
//   }
// } 

// Setup Restify Server for a bare-bones web service.
var server = restify.createServer();
server.use(bot.verifyBotFramework({ appId: myAppId, appSecret: myAppSecret }));
server.get('/', restify.serveStatic({
    directory: __dirname,
    default: '/index.html'
}));
server.post('/api/messages', bot.verifyBotFramework(), bot.listen());
server.listen(process.env.port || 3000, function () {
    console.log('%s listening to %s', server.name, server.url);
});

//bot.listen() listens to a route off the Restify server.
//bot.listenStdin() begins monitoring console input (from the command line).

// For security reasons it is recommended that you lock your server down 
// to only receive requests from the Bot Connector Service, 
// so we can call verifyBotFramework() to install a piece of middleware that does that.