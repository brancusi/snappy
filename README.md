# Snapper - RPi2 + Node + gPhoto2

### Please note there is a lot missing from these docs right now. More to come soon.

__Snapper__ allows you to create swarms of cameras that can be controlled and triggered through a simple web interface.

Using the Raspberry Pi platform, each camera becomes an autonomous node in the cluster that manages its own image processing and uploading of synchronized swarm pictures.

![Landing](http://wildsnapper.s3.amazonaws.com/Screen%20Shot%202015-08-16%20at%209.17.04%20PM.png)
![Swarm](http://wildsnapper.s3.amazonaws.com/Screen%20Shot%202015-08-16%20at%209.17.20%20PM.png)

[Official site](http://brancusi.github.io/snappy/)

## The stack

1. [resin.io](http://resin.io/) - For provisioning and managing the device fleet
1. [pubnub](https://www.pubnub.com/) - For the pub/sub and command triggering
1. [firebase](https://www.firebase.com/) - For the data layer
1. [auth0](https://auth0.com/) - For user identity management of the swarm admin
1. [emberjs](https://emberjs.com/) - For the swarm admin app

## Hardware Setup

1. [Raspberry Pi 2 Model B](https://www.raspberrypi.org/products/raspberry-pi-2-model-b/)
1. Your camera of choice. [Supported gphoto2](http://www.gphoto.org/doc/remote/)

For fast shutter capture __snapper__ uses GPIO on the RPi-2. This is useful when using a flash or when more than 1 camera is involved in the setup and precise timing is required.

### Circuit diagram

![RPi-2 Switch Circuit](http://wildsnapper.s3.amazonaws.com/transistor-study.svg)

### Parts
1. 1 - PN2222A - Transistor
1. 1 - 1m Ω - Resistor
1. Jumper wires

## Software setup

Snapper was built and tested using [resin.io](http://resin.io). This allows for super easy provisioning of the Pi2.

### Raspberry Pi 2 - Setup (Resin.io)

1. Setup an account at resin.io
1. Follow their instructions for setting up the base device OS: [guide](http://docs.resin.io/#/pages/installing/gettingStarted.md). Pay close attention to the wifi setting if you are going wireless.
1. Make note of the remote branch for your app on resin. We will use this in the coming steps
1. Clone snapper `git clone git@github.com:brancusi/snappy.git`
1. Now add the remote branch listed on resin under your new app: `git remote add resin <RESIN REPO URL>`
1. You can now push code to your device using: `git push resin`
1. Magic!

### Setting up Pubnub

For pub/sub __snapper__ uses [Pubnub](http://pubnub.com)

1. Setup free dev account at pubnub
1. Copy your access keys from your pubnub dashboard
1. Refer to the env vars below and add the info through the resin.io dashboard

### Setting up firebase

For the data layer __snapper__ uses [Firebase](http://firebase.com)

1. Setup free dev account at firebase
1. Refer to the env vars below and add the info through the resin.io dashboard

### ENV Vars used by your device

```
FIREBASE_URL=https://<YOUR_APP>.firebaseio.com/

PUBNUB_PUBLISH_KEY=YOUR_PUB_KEY
PUBNUB_SUBSCRIBE_KEY=YOU_SUB_KEY

SWARM_ID=YOUR_SWARM_NAME

AWS_ACCESS_KEY_ID=AWS_KEY
AWS_SECRET_ACCESS_KEY=AWS_SECRET

NODE_NAME=NAME_OF_THIS_NODE
```