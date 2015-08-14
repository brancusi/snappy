FROM resin/raspberrypi2-node:onbuild

ENV INITSYSTEM on

RUN apt-get update && apt-get install -y \
  dcraw \
  gphoto2 \
  imagemagick