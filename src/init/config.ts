/*
all config/init setup of the app
*/

import { Application } from 'express'; //we only need the app declaration here

let init = (app: Application) => {

  /*
  middleware for express
  */

  //set EJS as view engine
  app.set('view engine', 'ejs');

/*
  var bodyParser = require("body-parser");
  var session = require("express-session");
  var fileUpload = require('express-fileupload');

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.use(session({secret: 'tempsecret', resave: false, saveUninitialized: false}));
  app.use(fileUpload());

  app.use('/public', express.static(__dirname + '/public')); //make everything in public accessible
*/

};

export { init };