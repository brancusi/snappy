# gPhoto + RPi2 + Emberjs

Welcome to __snappyapp__ where you can create swarms of cameras and control them individually and all at once.

[Official site](http://brancusi.github.io/snappy/)

## The stack

1. [resin.io](http://resin.io/) - For provisioning and managing the device fleet
1. [pubnub](https://www.pubnub.com/) - For the pub/sub and command triggering
1. [firebase](https://www.firebase.com/) - For the data layer
1. [auth0](https://auth0.com/) - For user identity managment of the swarm admin
1. [emberjs](https://emberjs.com/) - For the swarm admin app

## Hardware Setup

1. [Raspberry Pi 2 Model B](https://www.raspberrypi.org/products/raspberry-pi-2-model-b/)
1. Your camera of choice. [Supported gphoto2](http://www.gphoto.org/doc/remote/)
1. A breadboard
1. 1 - PN2222A - Transistor
1. 1 - 900k Ω - Resistor
1. 1 - Diode
1. 