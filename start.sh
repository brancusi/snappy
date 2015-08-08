#!/bin/bash

pm2 link $PUBLIC_KEY $SECRET_KEY $RESIN_DEVICE_UUID

pm2 start /app/server.js

pm2 logs