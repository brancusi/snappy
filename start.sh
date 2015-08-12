#!/bin/bash

pm2 link $KM_PUBLIC_KEY $KM_SECRET_KEY $DEVICE_NAME

pm2 start /app/server.js --name "camera-client"

pm2 logs