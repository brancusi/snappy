#!/bin/bash

# Setup PM2 Monitoring and auto restart
pm2 link $KM_PUBLIC_KEY $KM_SECRET_KEY $DEVICE_NAME

pm2 start $APP/server.js --name "camera-client"

pm2 logs