require('dotenv').load();

var app = require('./modules/app')(process.env.FIREBASE_URL, process.env.PUBNUB_PUBLISH_KEY, process.env.PUBNUB_SUBSCRIBE_KEY);