#!/bin/bash

# Make the image directories
mkdir /data/new
mkdir /data/pending
mkdir /data/preview

# Setup PM2 Monitoring and auto restart
pm2 link $KM_PUBLIC_KEY $KM_SECRET_KEY $DEVICE_NAME

pm2 start /app/server.js --name "camera-client"

pm2 logs