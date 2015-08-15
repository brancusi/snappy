FROM resin/raspberrypi2-node:0.12.4:onbuild

ENV INITSYSTEM on

RUN apt-get update && apt-get install -y \
  dcraw \
  gphoto2 \
  imagemagick