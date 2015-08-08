require('dotenv').load();

var app = require('./modules/app')(process.env.FIRE_BASE, process.env.PUBLISH_KEY, process.env.SUBSCRIBE_KEY);
app.bootstrap();